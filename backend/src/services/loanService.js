const Loan = require('../models/Loan');
const User = require('../models/User');
const xrplService = require('./xrplService');
const creditScoreClient = require('./creditScoreClient');
const XummSubscriptionHandler = require('./xummSubscriptionHandler');

class LoanService {
  constructor() {
    this.xummHandler = new XummSubscriptionHandler(
      process.env.XUMM_API_KEY, 
      process.env.XUMM_API_SECRET
    );
  }
  /**
   * Calculate risk category based on PCA risk score
   * @param {number} pcaScore - The PCA risk score (0-100)
   * @returns {object} Risk category and appropriate loan terms
   */
  calculateRiskCategory(pcaScore) {
    // Risk categories based on provided PCA data
    // Note: For undercollateralized lending, we use much stricter criteria
    if (pcaScore <= 36.2) { // Very Low Risk mean
      return {
        category: 'Very Low Risk',
        interestRate: 0.12, // 12% - higher than traditional lending due to undercollateralization
        collateralRatio: 0.60, // Only 60% of loan needs to be collateralized
        maxLoanTerm: 90, // days
        maxLoanAmount: 1000, // More conservative amounts due to undercollateralization
        eligibleForUndercollateralized: true
      };
    } else if (pcaScore <= 44.5) { // Low Risk mean
      return {
        category: 'Low Risk',
        interestRate: 0.18, // 18%
        collateralRatio: 0.70, // 70% collateral required
        maxLoanTerm: 60, // days
        maxLoanAmount: 750,
        eligibleForUndercollateralized: true
      };
    } else if (pcaScore <= 56.5) { // Medium Risk mean
      return {
        category: 'Medium Risk',
        interestRate: 0.25, // 25%
        collateralRatio: 0.80, // 80% collateral required
        maxLoanTerm: 45, // days
        maxLoanAmount: 500,
        eligibleForUndercollateralized: true
      };
    } else if (pcaScore <= 80) { // High Risk mean
      return {
        category: 'High Risk',
        interestRate: 0.35, // 35%
        collateralRatio: 0.90, // 90% collateral required (almost fully collateralized)
        maxLoanTerm: 30, // days
        maxLoanAmount: 300,
        eligibleForUndercollateralized: true
      };
    } else {
      return {
        category: 'Very High Risk',
        interestRate: 0, // Not eligible for undercollateralized loans
        collateralRatio: 1.5, // Would require overcollateralization (not offering this product)
        maxLoanTerm: 0, // Not eligible
        maxLoanAmount: 0, // Not eligible
        eligibleForUndercollateralized: false
      };
    }
  }

  /**
   * Create a new undercollateralized loan application
   * @param {string} borrowerWalletAddress - Borrower's XRP wallet address
   * @param {number} amount - Requested loan amount
   * @param {number} term - Loan term in days
   * @param {number} collateralAmount - Proposed collateral amount (less than loan amount)
   * @returns {Promise<object>} Created loan object with risk assessment
   */
  async createLoanApplication(borrowerWalletAddress, amount, term, collateralAmount) {
    try {
      // Get or create user
      let user = await User.findOne({ walletAddress: borrowerWalletAddress });
      if (!user) {
        user = new User({ walletAddress: borrowerWalletAddress });
        await user.save();
      }

      // Get credit score - CRITICAL for undercollateralized lending
      let creditScore = user.creditScore;
      if (!creditScore || creditScore === 0) {
        creditScore = await creditScoreClient.getCreditScore(borrowerWalletAddress);
        user.creditScore = creditScore.risk_score;
        await user.save();
      };
      
      // Determine risk category and loan terms
      const riskProfile = this.calculateRiskCategory(creditScore);
      
      // Check if borrower is eligible for undercollateralized lending
      if (!riskProfile.eligibleForUndercollateralized) {
        throw new Error(`Your risk profile (${riskProfile.category}) does not qualify for undercollateralized lending.`);
      }
      
      // Validate loan parameters
      if (amount > riskProfile.maxLoanAmount) {
        throw new Error(`Loan amount exceeds maximum for your risk profile (${riskProfile.maxLoanAmount} XRP)`);
      }
      
      if (term > riskProfile.maxLoanTerm) {
        throw new Error(`Loan term exceeds maximum for your risk profile (${riskProfile.maxLoanTerm} days)`);
      }
      
      // Calculate minimum required collateral (which is less than the loan amount)
      const minRequiredCollateral = amount * riskProfile.collateralRatio;
      
      // For undercollateralized loans, we ensure:
      // 1. Collateral is less than loan amount (that's the point of undercollateralized)
      // 2. Collateral meets minimum requirement based on risk profile
      if (collateralAmount > amount) {
        throw new Error(`For undercollateralized loans, collateral (${collateralAmount} XRP) must be less than loan amount (${amount} XRP)`);
      }
      
      if (collateralAmount < minRequiredCollateral) {
        throw new Error(`Insufficient collateral. Minimum required for your risk profile: ${minRequiredCollateral} XRP (${riskProfile.collateralRatio * 100}% of loan amount)`);
      }

      const applicationDate = new Date();
      const dueDate = new Date(applicationDate);
      dueDate.setDate(applicationDate.getDate() + parseInt(term))

      // Create loan in PENDING status
      const newLoan = new Loan({
        borrower: borrowerWalletAddress,
        amount,
        collateralAmount,
        interestRate: riskProfile.interestRate,
        term,
        status: 'PENDING',
        createdAt: applicationDate,
        dueDate: dueDate
      });

      await newLoan.save();
      
      const xrplService = require('./xrplService');
      const escrowPayload = await xrplService.createCollateralEscrowPayload(
        borrowerWalletAddress,
        newLoan.collateralAmount,
        newLoan.term
      );
      
      newLoan.escrowPayloadId = escrowPayload.uuid;
      await newLoan.save();
      return { loan: newLoan, escrowPayload };
    } catch (error) {
      console.error('Error creating undercollateralized loan application:', error);
      throw error;
    }
  }

  /**
   * Subscribe to loan payload signature events
   * @param {string} loanId - The loan ID to subscribe to
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToLoanSignature(loanId) {
    try {
      // Get loan from database
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      
      if (!loan.escrowPayloadId) {
        throw new Error('No escrow payload ID found for loan');
      }
      
      // Create subscription with callbacks
      const result = await this.xummHandler.subscribeToPayload(
        loan.escrowPayloadId,
        loanId,
        // onSigned callback
        async (loanId, payload) => {
          console.log(`[${new Date().toISOString()}] Processing signed transaction for loan ${loanId}`);
          await this.executeLoan(loanId, payload.uuid, loan.borrower);
        },
        // onRejected callback
        async (loanId) => {
          console.log(`[${new Date().toISOString()}] Processing rejected transaction for loan ${loanId}`);
          await this.rejectLoan(loanId);
        }
      );
      
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error subscribing to loan signature:`, error);
      throw error;
    }
  }

  /**
     * Manually check if a loan's payload has been signed
     * @param {string} loanId - The loan ID to check
     * @returns {Promise<Object>} Result of verification and execution
     */
  async verifyLoanSignature(loanId) {
    try {
      // Get loan
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      
      // Check payload status directly
      const payload = await this.xummHandler.checkPayloadStatus(loan.escrowPayloadId);
      
      if (payload.meta.signed === true) {
        // Execute the loan
        console.log(`[${new Date().toISOString()}] Manual verification found signed payload for loan ${loanId}`);
        return await this.executeLoan(loanId, loan.escrowPayloadId, loan.borrower);
      } else {
        return { 
          success: false, 
          message: 'Transaction not signed yet',
          payloadStatus: payload.meta 
        };
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error verifying loan signature:`, error);
      throw error;
    }
  }

  async executeLoan(loanId, payloadId, walletAddress) {
    const loan = await Loan.findById(loanId);

    // --- Security and State Checks ---
    if (!loan) throw new Error("Loan not found.");
    if (loan.borrower !== walletAddress) throw new Error("Authorization error: Wallet address does not match loan borrower.");
    if (loan.status !== 'PENDING') throw new Error(`Loan is not pending signature. Current status: ${loan.status}`);
    if (loan.escrowPayloadId !== payloadId) throw new Error("Payload ID mismatch.");

    // 1. Securely verify the payload signature with the Xumm API on the backend
    const verification = await xrplService.verifySignature(payloadId);
    if (!verification.signed) {
      throw new Error("Xumm signature verification failed.");
    }
    
    console.log(`[LoanService] Signature verified for loan ${loanId}.`);

    // 2. Disburse the full loan amount from the protocol to the borrower
    const disburseResult = await xrplService.disburseLoan(loan.borrower, loan.amount);

    // 3. Update the loan document to ACTIVE
    loan.status = 'ACTIVE';
    loan.collateralTxHash = verification.txid; // The hash of the successful EscrowCreate tx
    loan.disbursementTxHash = disburseResult.txHash;
    loan.activationDate = new Date();
    // In a real system, we'd get the escrow sequence from the transaction metadata
    loan.escrowSequence = disburseResult.sequence; 
    
    await loan.save();

    console.log(`[LoanService] Loan ${loanId} is now ACTIVE.`);
    return { success: true, loan };
  }

  /**
   * Approve an undercollateralized loan and initiate disbursement
   * @param {string} loanId - ID of the loan to approve
   * @returns {Promise<object>} Updated loan object
   */
  async approveLoan(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'PENDING') {
        throw new Error(`Cannot approve loan with status: ${loan.status}`);
      }

      // Create escrow for the partial collateral
      const escrowPayload = await xrplService.createCollateralEscrow(
        loan.borrower,
        loan.collateralAmount,
        loan.term
      );

      // Simulate escrow sequence and transaction hash for hackathon
      loan.escrowSequence = Math.floor(Math.random() * 1000000) + 1000000;
      loan.escrowTxHash = `ESCROW_TX_${Math.random().toString(36).substring(2, 15)}`;

      // Create disbursement transaction for the full loan amount
      // This is where the undercollateralized magic happens - we disburse more than we hold as collateral
      const disbursementPayload = await xrplService.createLoanDisbursement(
        loan.borrower,
        loan.amount, // Full amount, greater than collateral
        loan._id
      );

      // Simulate disbursement transaction hash
      loan.disbursementTxHash = `DISBURSE_TX_${Math.random().toString(36).substring(2, 15)}`;

      // Update loan status and timestamps
      loan.status = 'ACTIVE';
      loan.approvedAt = new Date();
      
      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + loan.term);
      loan.dueDate = dueDate;

      await loan.save();
      return loan;
    } catch (error) {
      console.error('Error approving undercollateralized loan:', error);
      throw error;
    }
  }

  /**
   * Create a repayment request for a loan
   * @param {string} loanId - ID of the loan being repaid
   * @param {number} amount - Repayment amount
   * @param {string} borrowerAddress - Address of the borrower making payment
   * @returns {Promise<object>} Repayment data and XUMM payload
   */
  async createRepaymentRequest(loanId, amount, borrowerAddress) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'ACTIVE') {
        throw new Error(`Cannot process repayment for loan with status: ${loan.status}`);
      }
      
      // Verify borrower is the actual loan borrower
      if (loan.borrower !== borrowerAddress) {
        throw new Error('Unauthorized: Only the borrower can repay this loan');
      }
      
      // Calculate total owed (principal + interest)
      const interestAmount = loan.amount * (loan.interestRate / 100);
      const totalOwed = loan.amount + interestAmount;
      
      // Calculate total repaid so far
      const totalRepaid = loan.repayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      
      // Calculate remaining balance
      const remainingBalance = Math.max(0, totalOwed - totalRepaid);
      
      // Validate repayment amount
      if (amount <= 0) {
        throw new Error('Repayment amount must be greater than zero');
      }
      
      if (amount > remainingBalance) {
        throw new Error(`Repayment amount (${amount} XRP) exceeds remaining balance (${remainingBalance} XRP)`);
      }
      
      // Create a new repayment record
      const repayment = {
        amount,
        timestamp: new Date(),
        confirmed: false
      };
      
      // If we don't have a repayments array yet, create it
      if (!loan.repayments) {
        loan.repayments = [];
      }
      
      // Add the repayment to the loan's repayments array
      loan.repayments.push(repayment);
      await loan.save();
      
      // Get the ID of the newly added repayment (last element in the array)
      const repaymentId = loan.repayments[loan.repayments.length - 1]._id;
      
      // Create XUMM payload for the repayment transaction
      const payload = await xrplService.createRepaymentPayload(
        borrowerAddress, 
        amount,
        loanId
      );
      
      // Update the repayment with the payload ID
      const repaymentIndex = loan.repayments.findIndex(r => r._id.toString() === repaymentId.toString());
      if (repaymentIndex !== -1) {
        loan.repayments[repaymentIndex].payloadId = payload.uuid;
        await loan.save();
      }
      
      // Return repayment data and payload
      return { 
        repayment: loan.repayments[repaymentIndex], 
        payload 
      };
    } catch (error) {
      console.error('Error creating repayment request:', error);
      throw error;
    }
  }

  /**
   * Subscribe to repayment payload signature events
   * @param {string} loanId - The loan ID 
   * @param {string} repaymentId - The repayment ID
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeToRepaymentSignature(loanId, repaymentId) {
    try {
      // Get loan from database
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      
      // Find the specific repayment
      const repayment = loan.repayments.find(r => r._id.toString() === repaymentId);
      if (!repayment) {
        throw new Error('Repayment not found');
      }
      
      if (!repayment.payloadId) {
        throw new Error('No payload ID found for repayment');
      }
      
      // Create subscription with callbacks
      const result = await this.xummHandler.subscribeToPayload(
        repayment.payloadId,
        `${loanId}:${repaymentId}`, // Use combined ID for context
        // onSigned callback
        async (context, payload) => {
          const [loanId, repaymentId] = context.split(':');
          console.log(`[${new Date().toISOString()}] Processing signed repayment for loan ${loanId}, repayment ${repaymentId}`);
          await this.processRepaymentSignature(loanId, repaymentId, payload.uuid);
        },
        // onRejected callback
        async (context) => {
          const [loanId, repaymentId] = context.split(':');
          console.log(`[${new Date().toISOString()}] Processing rejected repayment for loan ${loanId}, repayment ${repaymentId}`);
          await this.rejectRepayment(loanId, repaymentId);
        }
      );
      
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error subscribing to repayment signature:`, error);
      throw error;
    }
  }

  /**
   * Manually verify a repayment signature
   * @param {string} loanId - The loan ID
   * @param {string} repaymentId - The repayment ID
   * @returns {Promise<Object>} Result of verification
   */
  async verifyRepaymentSignature(loanId, repaymentId) {
    try {
      // Get loan
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      
      // Find the repayment
      const repaymentIndex = loan.repayments.findIndex(r => r._id.toString() === repaymentId);
      if (repaymentIndex === -1) {
        throw new Error('Repayment not found');
      }
      
      const repayment = loan.repayments[repaymentIndex];
      if (!repayment.payloadId) {
        throw new Error('No payload ID found for repayment');
      }
      
      // Check payload status directly
      const payload = await this.xummHandler.checkPayloadStatus(repayment.payloadId);
      
      if (payload.meta.signed === true) {
        // Process the repayment
        console.log(`[${new Date().toISOString()}] Manual verification found signed payload for repayment`);
        return await this.processRepaymentSignature(loanId, repaymentId, repayment.payloadId);
      } else {
        return { 
          success: false, 
          message: 'Transaction not signed yet',
          payloadStatus: payload.meta 
        };
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error verifying repayment signature:`, error);
      throw error;
    }
  }

  /**
   * Process a signed repayment
   * @param {string} loanId - The loan ID
   * @param {string} repaymentId - The repayment ID
   * @param {string} payloadId - The XUMM payload ID
   * @returns {Promise<Object>} Processing result
   */
  async processRepaymentSignature(loanId, repaymentId, payloadId) {
    try {
      // Get loan
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      
      // Find the repayment
      const repaymentIndex = loan.repayments.findIndex(r => r._id.toString() === repaymentId);
      if (repaymentIndex === -1) {
        throw new Error('Repayment not found');
      }
      
      // Verify the signature
      const verification = await xrplService.verifySignature(payloadId);
      if (!verification.signed) {
        throw new Error('Signature verification failed');
      }
      
      // Update repayment with transaction details
      loan.repayments[repaymentIndex].txHash = verification.txid;
      loan.repayments[repaymentIndex].confirmed = true;
      
      // Calculate total owed (principal + interest)
      const interestAmount = loan.amount * (loan.interestRate / 100);
      const totalOwed = loan.amount + interestAmount;
      
      // Calculate total repaid including this repayment
      const totalRepaid = loan.repayments.reduce((sum, payment) => {
        return payment.confirmed ? sum + payment.amount : sum;
      }, 0);
      
      console.log('TOTAL_REPAID', totalRepaid);
      console.log("TOTAL_OWED", totalOwed);
      // Check if loan is fully repaid
      if (totalRepaid >= totalOwed) {
        loan.status = 'REPAID';
        loan.repaidAt = new Date();
        
        // If collateral is in escrow, release it
        if (loan.escrowSequence) {
          try {
            // This would be handled async in a real system to prevent blocking
            await xrplService.releaseCollateral(loan.escrowSequence, loan.borrower);
            loan.collateralReleased = true;
            loan.collateralReleasedAt = new Date();
          } catch (escrowError) {
            console.error('Error releasing collateral:', escrowError);
            // Don't fail the whole process if escrow release fails
            // A separate process should retry failed escrow releases
          }
        }
      }
      
      await loan.save();
      
      return {
        success: true,
        loan,
        repaymentId,
        txHash: verification.txid,
        isFullyRepaid: loan.status === 'REPAID'
      };
    } catch (error) {
      console.error('Error processing repayment signature:', error);
      throw error;
    }
  }

  /**
   * Reject a repayment request
   * @param {string} loanId - The loan ID
   * @param {string} repaymentId - The repayment ID
   * @returns {Promise<Object>} Rejection result
   */
  async rejectRepayment(loanId, repaymentId) {
    try {
      // Get loan
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      
      // Find and remove the repayment
      const repaymentIndex = loan.repayments.findIndex(r => r._id.toString() === repaymentId);
      if (repaymentIndex === -1) {
        throw new Error('Repayment not found');
      }
      
      // Mark as rejected instead of removing
      loan.repayments[repaymentIndex].rejected = true;
      loan.repayments[repaymentIndex].rejectedAt = new Date();
      
      await loan.save();
      
      return {
        success: true,
        message: 'Repayment request rejected'
      };
    } catch (error) {
      console.error('Error rejecting repayment:', error);
      throw error;
    }
  }

  /**
   * Reject a loan application
   * @param {string} loanId - ID of the loan to reject
   * @returns {Promise<object>} Updated loan object
   */
  async rejectLoan(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'PENDING') {
        throw new Error(`Cannot reject loan with status: ${loan.status}`);
      }

      loan.status = 'REJECTED';
      await loan.save();
      return loan;
    } catch (error) {
      console.error('Error rejecting loan:', error);
      throw error;
    }
  }

  /**
   * Process a loan repayment
   * @param {string} loanId - ID of the loan being repaid
   * @param {number} amount - Repayment amount
   * @param {string} txHash - Transaction hash of the repayment
   * @returns {Promise<object>} Updated loan object
   */
  async processRepayment(loanId, amount, txHash) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== 'ACTIVE') {
        throw new Error(`Cannot process repayment for loan with status: ${loan.status}`);
      }

      // Add repayment to history
      loan.repaymentHistory.push({
        amount,
        txHash,
        date: new Date()
      });

      // Calculate total repaid
      const totalRepaid = loan.repaymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate total owed (principal + interest)
      const totalOwed = loan.amount * (1 + loan.interestRate);

      // Check if loan is fully repaid
      if (totalRepaid >= totalOwed) {
        loan.status = 'REPAID';
        
        // Release collateral
        await xrplService.releaseCollateral(loan.escrowSequence, loan.borrower);
      }

      await loan.save();
      return loan;
    } catch (error) {
      console.error('Error processing repayment:', error);
      throw error;
    }
  }

  /**
   * Handle defaulted undercollateralized loans
   * @param {string} loanId - ID of the defaulted loan
   * @param {boolean} [forceDefault=false] - Force default even if not past due (admin override)
   * @returns {Promise<object>} Updated loan object
   */
  async handleDefaultedLoan(loanId, forceDefault = false) {
    try {
      console.log(`[DEFAULT] Beginning default process for loan ${loanId}`);
      
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      // Check loan status
      if (loan.status !== 'ACTIVE') {
        throw new Error(`Cannot mark as defaulted: loan with status ${loan.status}`);
      }
      
      // Verify the loan is past due (unless force default is enabled)
      if (!forceDefault) {
        const now = new Date();
        const dueDate = new Date(loan.dueDate);
        
        if (now < dueDate) {
          console.log(`[DEFAULT] Loan ${loanId} is not yet past due. Due date: ${dueDate.toISOString()}`);
          throw new Error(`Cannot mark as defaulted: loan is not yet past due. Due date: ${dueDate.toISOString()}`);
        }
        
        const gracePeriod = process.env.DEFAULT_GRACE_PERIOD_DAYS || 3; // days
        const gracePeriodEnd = new Date(dueDate);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + parseInt(gracePeriod));
        
        if (now < gracePeriodEnd) {
          console.log(`[DEFAULT] Loan ${loanId} is within grace period of ${gracePeriod} days`);
          throw new Error(`Cannot mark as defaulted: loan is within grace period of ${gracePeriod} days`);
        }
        
        console.log(`[DEFAULT] Loan ${loanId} is past due date and grace period`);
      } else {
        console.log(`[DEFAULT] Force defaulting loan ${loanId} by admin override`);
      }

      const repayments = loan.repayments || [];
      
      // Calculate from repayments array (new structure)
      const totalRepaid = repayments.reduce(
        (sum, payment) => payment.confirmed ? sum + payment.amount : sum, 
        0
      );
      
      // Calculate total owed (principal + interest)
      // Check if interest rate is stored as percentage or decimal
      let interestRate = loan.interestRate;
      if (interestRate > 1) {
        // Convert from percentage to decimal if needed
        interestRate = interestRate / 100;
      }
      
      const interestAmount = loan.amount * interestRate;
      const totalOwed = loan.amount + interestAmount;
      const remainingOwed = Math.max(0, totalOwed - totalRepaid);
      
      // Calculate how much is covered by collateral and how much is actual loss
      const collateralValue = loan.collateralAmount;
      const uncoveredLoss = Math.max(0, remainingOwed - collateralValue);
      
      console.log(`[DEFAULT] Loan ${loanId} default metrics:
        Total Owed: ${totalOwed} XRP
        Total Repaid: ${totalRepaid} XRP
        Remaining: ${remainingOwed} XRP
        Collateral: ${collateralValue} XRP
        Uncovered Loss: ${uncoveredLoss} XRP
      `);
      
      let claimTxHash = null;
      
      // If there is an escrow sequence, claim it on the XRPL
      if (loan.escrowSequence) {
        try {
          console.log(`[DEFAULT] Attempting to claim escrow for loan ${loanId} with sequence ${loan.escrowSequence}`);
          const claimResult = await xrplService.claimCollateralEscrow(
            loan.borrower,
            loan.escrowSequence
          );
          
          claimTxHash = claimResult.txHash;
          console.log(`[DEFAULT] Successfully claimed collateral for loan ${loanId}, txHash: ${claimTxHash}`);
        } catch (escrowError) {
          console.error(`[ERROR] Failed to claim escrow for defaulted loan ${loanId}:`, escrowError);
          
          // Generate a placeholder hash for recording purposes
          claimTxHash = `ERROR_CLAIM_TX_${Math.random().toString(36).substring(2, 15)}`;
          console.log(`[DEFAULT] Using placeholder tx hash for failed claim: ${claimTxHash}`);
        }
      } else {
        console.warn(`[WARNING] No escrow sequence found for loan ${loanId}`);
        claimTxHash = `MISSING_ESCROW_TX_${Math.random().toString(36).substring(2, 15)}`;
      }
      
      // Update loan status
      loan.status = 'DEFAULTED';
      loan.defaultDetails = {
        totalOwed,
        totalRepaid,
        remainingOwed,
        collateralClaimed: collateralValue,
        uncoveredLoss,
        claimTxHash,
        defaultedAt: new Date(),
        reason: forceDefault ? 'Administrative action' : 'Loan past due date with insufficient repayment'
      };
      
      await loan.save();
      console.log(`[DEFAULT] Loan ${loanId} status updated to DEFAULTED`);
      
      return loan;
    } catch (error) {
      console.error(`[ERROR] Error handling defaulted loan ${loanId}:`, error);
      throw error;
    }
  }

  /**
   * Get loans for a borrower
   * @param {string} borrowerWalletAddress - Borrower's wallet address
   * @returns {Promise<Array>} Array of loans
   */
  async getBorrowerLoans(borrowerWalletAddress) {
    try {
      return await Loan.find({ borrower: borrowerWalletAddress });
    } catch (error) {
      console.error('Error getting borrower loans:', error);
      throw error;
    }
  }

  /**
   * Get a loan by ID
   * @param {string} loanId - Loan ID
   * @returns {Promise<object>} Loan object
   */
  async getLoanById(loanId) {
    try {
      const loan = await Loan.findById(loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }
      return loan;
    } catch (error) {
      console.error('Error getting loan by ID:', error);
      throw error;
    }
  }

  async getPlatformMetrics() {
    try {
      // Get all loans - this is the ONLY database query we need now.
      const loans = await Loan.find();
      
      // --- All this calculation logic is good and remains the same ---
      const totalLoans = loans.length;
      const activeLoans = loans.filter(loan => loan.status === 'ACTIVE').length;
      const repaidLoans = loans.filter(loan => loan.status === 'REPAID').length;
      const defaultedLoans = loans.filter(loan => loan.status === 'DEFAULTED').length;
      const totalLoanVolume = loans.reduce((sum, loan) => sum + loan.amount, 0);
      const totalCollateralLocked = loans
        .filter(loan => loan.status === 'ACTIVE')
        .reduce((sum, loan) => sum + loan.collateralAmount, 0);
      const totalUndercollateralizedAmount = loans
        .filter(loan => loan.status === 'ACTIVE')
        .reduce((sum, loan) => sum + (loan.amount - loan.collateralAmount), 0);
      const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0; // As percentage
      const totalLossAmount = loans
        .filter(loan => loan.status === 'DEFAULTED' && loan.defaultDetails)
        .reduce((sum, loan) => sum + (loan.defaultDetails.uncoveredLoss || 0), 0);
      const avgCollateralRatio = totalLoans > 0
        ? (loans.reduce((sum, loan) => sum + (loan.collateralAmount / loan.amount), 0) / totalLoans) * 100 // As percentage
        : 0;
  
      // --- START: CORRECTED RISK DISTRIBUTION LOGIC ---
  
      // 1. Initialize the distribution map.
      const riskDistribution = {
        'Very Low Risk': 0,
        'Low Risk': 0,
        'Medium Risk': 0,
        'High Risk': 0,
        'Very High Risk': 0,
        'Unknown': 0 // For older loans without the field
      };
      
      // 2. Iterate through the loans we already fetched. NO extra DB call!
      for (const loan of loans) {
        if (loan.riskCategory) {
          // Increment the count for the category stored ON THE LOAN.
          riskDistribution[loan.riskCategory]++;
        } else {
          // Handle old data gracefully.
          riskDistribution['Unknown']++;
        }
      }
  
      // --- END: CORRECTED LOGIC ---
  
      return {
        totalLoans,
        activeLoans,
        repaidLoans,
        defaultedLoans,
        totalLoanVolume,
        totalCollateralLocked,
        totalUndercollateralizedAmount,
        defaultRate: defaultRate.toFixed(2) + '%',
        totalLossAmount,
        avgCollateralRatio: avgCollateralRatio.toFixed(2) + '%',
        riskDistribution
      };
    } catch (error) {
      console.error('Error getting platform metrics:', error);
      throw error;
    }
  }
}

module.exports = new LoanService();
import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, ExternalLink, AlertCircle, CheckCircle2, Loader2, Tag, RefreshCw } from 'lucide-react';
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useSwitchChain,
} from 'wagmi';
import { erc20Abi, maxUint256, createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';
import { ConnectKitButton } from 'connectkit';
import { toast } from 'sonner';
import { getUsdc, requireChain, buildTxExplorerUrl } from '@/onchain-facts';
import { parseAmount, formatUsdc as formatUsdcRaw } from '@/onchain-money';
import { PlatformIcon } from '../components/PlatformIcon';
import { ESCROW_ADDRESS, ESCROW_ABI } from '../lib/escrow';
import { formatUSDC, parseOnchainError, generateOrderId, saveOrderLabel } from '../lib/utils';
import { insertOrder, sendTelegramAlert } from '../lib/supabase';
import { CrateOpeningModal } from '../components/CrateOpeningModal';
import type { OrderSummary, Page } from '../types';

interface CheckoutPageProps {
  summary: OrderSummary;
  onNavigate: (page: Page) => void;
  onOrderComplete: () => void;
}

const CHAIN_ID = arcTestnet.id;
// Use the known Arc Testnet RPC from onchain-facts — never a bare http()
const ARC_RPC_URL = requireChain(CHAIN_ID).rpcUrls[0];
const RECEIPT_TIMEOUT_MS = 90_000; // 90s max wait

type CheckoutStep = 'idle' | 'approving' | 'pay' | 'paying' | 'saving' | 'done' | 'error';

export function CheckoutPage({ summary, onNavigate, onOrderComplete }: CheckoutPageProps) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const usdcFact = getUsdc(CHAIN_ID);
  const usdcAddress = usdcFact?.address as `0x${string}` | undefined;

  const finalPrice = summary.discountedPrice;
  const amountRaw = usdcFact ? parseAmount(CHAIN_ID, finalPrice.toFixed(6)).raw : 0n;

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<CheckoutStep>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [orderIdHex, setOrderIdHex] = useState<`0x${string}` | undefined>();
  const [errorMsg, setErrorMsg] = useState('');
  // For DB fallback: hold order data so we can retry without re-paying
  const pendingOrderRef = useRef<Parameters<typeof insertOrder>[0] | null>(null);
  const [hasPendingDbSave, setHasPendingDbSave] = useState(false);

  const isWrongChain = isConnected && chainId !== CHAIN_ID;

  // Public client with explicit Arc Testnet RPC — avoids viem's fallback failing silently
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && ESCROW_ADDRESS ? [address, ESCROW_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address && usdcAddress && ESCROW_ADDRESS) },
  });

  const hasEnoughAllowance = allowance !== undefined && allowance >= amountRaw;

  const { data: usdcBalance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address && usdcAddress), refetchInterval: 10_000 },
  });
  const hasEnoughBalance = usdcBalance !== undefined && usdcBalance >= amountRaw;
  const insufficientBalance = false;

  const { writeContractAsync: approveAsync } = useWriteContract();
  const { writeContractAsync: payAsync } = useWriteContract();

  // No auto-redirect — user navigates manually via the crate reveal button

  const handleApprove = useCallback(async () => {
    if (!usdcAddress || !ESCROW_ADDRESS) return;
    setStep('approving');
    setStatusMsg('Waiting for wallet approval...');
    try {
      const hash = await approveAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ESCROW_ADDRESS, maxUint256],
        chainId: CHAIN_ID,
      });
      setStatusMsg('Confirming approval on-chain...');
      // Wait for confirmation with explicit timeout
      const receipt = await Promise.race([
        publicClient.waitForTransactionReceipt({ hash, confirmations: 1 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Approval confirmation timed out after 90s. Please check your wallet and try again.')), RECEIPT_TIMEOUT_MS)
        ),
      ]);
      if (receipt.status !== 'success') {
        throw new Error('Approval transaction reverted on-chain.');
      }
      await refetchAllowance();
      setStep('pay');
      setStatusMsg('');
      toast.success('USDC approved — ready to pay!');
    } catch (err) {
      const msg = parseOnchainError(err);
      setStatusMsg('');
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('rejected')) {
        setStep('idle');
        toast.info('Approval cancelled.');
      } else {
        setErrorMsg(msg);
        setStep('error');
        toast.error(msg);
      }
    }
  }, [usdcAddress, approveAsync, publicClient, refetchAllowance]);

  const handlePay = useCallback(async () => {
    if (!address || !ESCROW_ADDRESS) return;

    // Pre-flight: check balance before submitting to avoid a wasted gas/reverted tx
    // if (!hasEnoughBalance) {
//   toast.error(`Payment Failed: Insufficient USDC balance. You need ${formatUSDC(finalPrice)} USDC.`);
//   return;
// }
    // if (!hasEnoughAllowance) {
//   toast.error('Payment Failed: USDC allowance insufficient. Please approve first.');
//   return;
// }

    const ts = Math.floor(Date.now() / 1000);
    const productId = `${summary.platform.id}-${summary.plan.id}`;
    const oid = generateOrderId(address, productId, ts);
    setOrderIdHex(oid);
    setStep('paying');
    setStatusMsg('Waiting for wallet signature...');

    try {
      // Step 1: broadcast createOrder
      const hash = await payAsync({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'createOrder',
        args: [oid, amountRaw],
        chainId: CHAIN_ID,
      });
      setTxHash(hash);
      saveOrderLabel(oid, `${summary.platform.name} — ${summary.plan.label}`);
      setStatusMsg('Transaction submitted — waiting for on-chain confirmation...');

      // Step 2: Wait for confirmed receipt BEFORE saving to DB or sending Telegram
      let receipt;
      try {
        receipt = await Promise.race([
          publicClient.waitForTransactionReceipt({ hash, confirmations: 1 }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(
              `Transaction confirmation timed out after 90s. ` +
              `Your tx hash is ${hash} — check the explorer to confirm if it mined.`
            )), RECEIPT_TIMEOUT_MS)
          ),
        ]);
      } catch (receiptErr) {
        // Timeout or RPC error — don't save to DB, show actionable error
        const errMsg = receiptErr instanceof Error ? receiptErr.message : String(receiptErr);
        setStatusMsg('');
        setErrorMsg(errMsg);
        setStep('error');
        toast.error(errMsg, { duration: 15000 });
        return;
      }

      // Step 3: Check receipt status — if reverted, abort entirely
      if (receipt.status !== 'success') {
        setStatusMsg('');
        const revertMsg = 'Payment Failed: Transaction reverted on-chain. USDC was NOT deducted. This usually means insufficient balance or the order ID was already used.';
        setErrorMsg(revertMsg);
        setStep('error');
        toast.error(revertMsg, { duration: 10000 });
        return;
      }

      // Step 4: Transaction confirmed — now save to DB
      setStatusMsg('Order confirmed on-chain! Saving your order...');
      setStep('saving');

      const orderData: Parameters<typeof insertOrder>[0] = {
        orderId:      oid,
        buyerWallet:  address.toLowerCase(),
        platform:     summary.platform.name,
        planDuration: summary.plan.label,
        amountUSDC:   finalPrice,
        userHandle:   summary.deliveryTarget,
        email:        email.trim() || null,
        promoCode:    summary.promoCode    ?? null,
        referralCode: summary.referralCode ?? null,
        txHash:       hash,
        chainId:      CHAIN_ID,
      };
      pendingOrderRef.current = orderData;
      setHasPendingDbSave(true);

      try {
        await insertOrder(orderData);
        pendingOrderRef.current = null;
        setHasPendingDbSave(false);
      } catch (dbErr: unknown) {
        const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        setStatusMsg('');
        setErrorMsg(
          `Your payment was confirmed on-chain (tx: ${hash.slice(0, 18)}...) but our database ` +
          `failed to record it: ${errMsg}. Click "Retry Save" below to try again without re-paying.`
        );
        setStep('error');
        toast.error('DB save failed — your USDC is safe in escrow. Use Retry Save.', { duration: 10000 });
        return;
      }

      // Step 5: All done — show success and send Telegram (after DB confirmed)
      setStep('done');
      setStatusMsg('');
      toast.success('Order placed successfully!');

      // Telegram notification — only fires after on-chain confirmation + DB save
      void sendTelegramAlert(
        `🛒 <b>New Order</b>\n\n` +
        `📦 <b>Product:</b> ${summary.platform.name} — ${summary.plan.label}\n` +
        `💰 <b>Amount:</b> ${finalPrice.toFixed(2)} USDC\n` +
        `👤 <b>Delivery to:</b> ${summary.deliveryTarget}\n` +
        (email.trim() ? `✉️ <b>Email:</b> ${email.trim()}\n` : '') +
        `🔑 <b>Order ID:</b> <code>${oid.slice(0, 18)}...</code>\n` +
        `🔗 <b>Tx Hash:</b> <code>${hash.slice(0, 18)}...</code>\n` +
        `⏰ <b>Time:</b> ${new Date().toUTCString()}`,
      );

    } catch (err) {
      const msg = parseOnchainError(err);
      setStatusMsg('');
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('rejected')) {
        setStep(hasEnoughAllowance ? 'pay' : 'idle');
        toast.info('Transaction cancelled.');
      } else {
        // Surface USDC-specific errors clearly
        const friendlyMsg = msg.toLowerCase().includes('transfer') || msg.toLowerCase().includes('erc20')
          ? `Payment Failed: Insufficient USDC balance or transaction reverted. (${msg})`
          : msg;
        setErrorMsg(friendlyMsg);
        setStep('error');
        toast.error(friendlyMsg);
      }
    }
  }, [address, summary, amountRaw, finalPrice, payAsync, publicClient, hasEnoughAllowance, hasEnoughBalance, email]);

  // DB retry without re-paying (for the DB fallback recovery flow)
  const handleRetryDbSave = useCallback(async () => {
    const orderData = pendingOrderRef.current;
    if (!orderData || !txHash) return;
    setStep('saving');
    setStatusMsg('Retrying database save...');
    try {
      await insertOrder(orderData);
      pendingOrderRef.current = null;
      setHasPendingDbSave(false);
      void sendTelegramAlert(
        `🔁 <b>Order DB Retry Success</b>\n\n` +
        `📦 <b>Product:</b> ${summary.platform.name} — ${summary.plan.label}\n` +
        `💰 <b>Amount:</b> ${orderData.amountUSDC.toFixed(2)} USDC\n` +
        `🔗 <b>Tx Hash:</b> <code>${txHash.slice(0, 18)}...</code>`,
      );
      setStep('done');
      setStatusMsg('');
      toast.success('Order saved successfully!');
    } catch (dbErr: unknown) {
      const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      setStep('error');
      setStatusMsg('');
      setErrorMsg(`DB save still failing: ${errMsg}. Contact support with tx hash: ${txHash}`);
      toast.error('DB save still failing — please contact support.');
    }
  }, [txHash, summary]);

  const planSavings = summary.originalPrice - summary.discountedPrice;
  const promoSavings = summary.promoDiscount
    ? summary.discountedPrice * (summary.promoDiscount / 100)
    : 0;

  const isDbRecovery = step === 'error' && hasPendingDbSave;

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => onNavigate('plan')}
        disabled={step === 'approving' || step === 'paying' || step === 'saving'}
        className="flex items-center gap-2 text-sm mb-8 transition-colors disabled:opacity-40"
        style={{ color: '#94A3B8' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#0EA5E9')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
      >
        <ArrowLeft size={16} />
        Back
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="display text-3xl font-700 mb-1" style={{ letterSpacing: '-0.03em', color: '#0F172A' }}>
          Checkout
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Review your order and pay with Arc USDC
        </p>
      </motion.div>

      {/* Order card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="rounded-2xl p-5 mb-5 card-hover"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(24px) saturate(1.9)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.9)',
          border: '1px solid rgba(255,255,255,0.65)',
          boxShadow: '0 4px 20px rgba(56,189,248,0.08), inset 0 1px 1px rgba(255,255,255,0.80)',
        }}
      >
        <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${summary.platform.color}12` }}
          >
            <PlatformIcon platformId={summary.platform.id} size={22} color={summary.platform.color} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{summary.platform.name}</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>{summary.plan.label} plan</p>
          </div>
        </div>
        <div className="pt-4 flex flex-col gap-2">
          <Row label="Delivery to" value={summary.deliveryTarget} mono />
          <Row label="Duration" value={summary.plan.label} />
          {planSavings > 0 && (
            <Row
              label={`Plan discount (${summary.plan.discount}%)`}
              value={`-${formatUSDC(planSavings)} USDC`}
              green
            />
          )}
          {promoSavings > 0 && summary.promoCode && (
            <div className="flex justify-between text-sm items-center">
              <span className="flex items-center gap-1.5" style={{ color: '#16A34A' }}>
                <Tag size={12} />
                Promo: {summary.promoCode}
              </span>
              <span style={{ color: '#16A34A' }}>-{formatUSDC(promoSavings)} USDC</span>
            </div>
          )}
          {summary.referralCredit && summary.referralCredit > 0 && (
            <Row
              label="Referral credit"
              value={`-${formatUSDC(summary.referralCredit)} USDC`}
              green
            />
          )}
          <div
            className="flex justify-between pt-3 border-t mt-1"
            style={{ borderColor: 'rgba(148,163,184,0.15)' }}
          >
            <span className="font-semibold" style={{ color: '#0F172A' }}>Total</span>
            <span
              className="display font-700 tabular text-lg"
              style={{
                background: 'linear-gradient(90deg, #0EA5E9, #F472B6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {formatUSDC(finalPrice)} USDC
            </span>
          </div>
        </div>
      </motion.div>

      {/* Email input */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.09 }}
        className="mb-5"
      >
        <label className="block text-sm font-semibold mb-2" style={{ color: '#0F172A' }}>
          Email Address <span style={{ color: '#F472B6' }}>*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={step === 'approving' || step === 'paying' || step === 'saving' || step === 'done'}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.85)',
            border: email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
              ? '1px solid rgba(220,38,38,0.40)'
              : '1px solid rgba(148,163,184,0.25)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            color: '#0F172A',
          }}
          onFocus={(e) => (e.currentTarget.style.border = '1px solid rgba(56,189,248,0.60)')}
          onBlur={(e) => (e.currentTarget.style.border =
            email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
              ? '1px solid rgba(220,38,38,0.40)'
              : '1px solid rgba(148,163,184,0.25)'
          )}
        />
        <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>
          We'll send your delivery confirmation to this address.
        </p>
      </motion.div>

      {/* Escrow notice */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(56,189,248,0.05) 0%, rgba(244,114,182,0.04) 100%)',
          border: '1px solid rgba(56,189,248,0.20)',
          boxShadow: '0 2px 12px rgba(56,189,248,0.08)',
        }}
      >
        <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#0EA5E9' }} />
        <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
          Your USDC is held in an on-chain escrow contract. If your order is not delivered within
          24 hours, you can claim a full refund directly from the contract.
        </p>
      </motion.div>

      {!ESCROW_ADDRESS && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6"
          style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.20)' }}
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#DC2626' }}>
            The escrow contract is being deployed. Checkout will be available shortly.
          </p>
        </motion.div>
      )}

      {/* Status banner while paying/saving */}
      {(step === 'paying' || step === 'saving' || step === 'approving') && statusMsg && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(244,114,182,0.06) 100%)',
            border: '1px solid rgba(56,189,248,0.25)',
          }}
        >
          <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: '#0EA5E9' }} />
          <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{statusMsg}</p>
        </motion.div>
      )}

      {/* Checkout actions */}
      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-sm text-center" style={{ color: '#64748B' }}>
            Connect your wallet to continue
          </p>
          <ConnectKitButton
            customTheme={{
              '--ck-primary-button-background': '#0EA5E9',
              '--ck-primary-button-hover-background': '#0284C7',
              '--ck-primary-button-color': '#ffffff',
              '--ck-body-background': '#ffffff',
              '--ck-body-color': '#0F172A',
            }}
          />
        </motion.div>
      ) : isWrongChain ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => switchChain({ chainId: CHAIN_ID })}
          className="w-full py-4 rounded-2xl font-semibold text-base transition-all"
          style={{
            background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.25)',
            color: '#DC2626',
          }}
        >
          Switch to Arc Testnet
        </motion.button>
      ) : step === 'done' ? (
        <CrateOpeningModal
          platform={summary.platform}
          planLabel={summary.plan.label}
          amountUsdc={formatUSDC(finalPrice)}
          txHash={txHash}
          orderId={orderIdHex}
          chainId={CHAIN_ID}
          onViewOrders={() => { onOrderComplete(); onNavigate('orders'); }}
        />
      ) : step === 'error' ? (
        <ErrorState
          msg={errorMsg}
          txHash={txHash}
          isDbRecovery={isDbRecovery}
          chainId={CHAIN_ID}
          onRetry={() => setStep(hasEnoughAllowance ? 'pay' : 'idle')}
          onRetryDbSave={() => { void handleRetryDbSave(); }}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="flex flex-col gap-3"
        >
          {insufficientBalance && (
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.20)' }}
            >
              <AlertCircle size={15} className="flex-shrink-0" style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>
                Insufficient USDC balance. You need {formatUSDC(finalPrice)} USDC to place this order.
              </p>
            </div>
          )}
          {/* Step 1: Approve — show a clear green approved badge when done */}
          {hasEnoughAllowance ? (
            <div
              className="w-full flex items-center gap-4 p-4 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg,rgba(22,163,74,0.08),rgba(16,185,129,0.06))',
                border: '1.5px solid rgba(22,163,74,0.30)',
                boxShadow: '0 4px 16px rgba(22,163,74,0.10), inset 0 1px 1px rgba(255,255,255,0.70)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(22,163,74,0.15)' }}>
                <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: '#16A34A' }}>USDC Approved</p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A' }}>✓ Active</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Max approval granted — proceed directly to Pay</p>
              </div>
            </div>
          ) : (
            <StepButton
              stepNum={1}
              label="Approve USDC"
              sublabel="One-time max approval — never approve again for this escrow"
              isPending={step === 'approving'}
              isDone={false}
              isActive={step !== 'approving' && step !== 'paying' && step !== 'saving'}
              isDisabled={!ESCROW_ADDRESS || step === 'paying' || step === 'approving' || step === 'saving' || Boolean(insufficientBalance)}
              onClick={() => { void handleApprove(); }}
            />
          )}
          <StepButton
            stepNum={2}
            label={insufficientBalance ? 'Insufficient USDC Balance' : 'Pay with Arc USDC'}
            sublabel={
              step === 'paying'
                ? (statusMsg || 'Waiting for on-chain confirmation...')
                : step === 'saving'
                ? 'Saving your order...'
                : insufficientBalance
                ? `Need ${formatUSDC(finalPrice)} USDC — get test USDC from the sidebar`
                : `Send ${formatUSDC(finalPrice)} USDC to escrow & place order`
            }
            isPending={step === 'paying' || step === 'saving'}
            isDone={false}
            isActive={(hasEnoughAllowance || step === 'pay') && step !== 'paying' && step !== 'saving' && !insufficientBalance}
            isDisabled={!ESCROW_ADDRESS || (!hasEnoughAllowance && step !== 'pay') || step === 'approving' || step === 'paying' || step === 'saving' || Boolean(insufficientBalance)}
            onClick={() => { void handlePay(); }}
            primary
          />
        </motion.div>
      )}

      <p className="text-center text-xs mt-4 mono" style={{ color: '#94A3B8' }}>
        {formatUsdcRaw(amountRaw)} USDC on Arc Testnet
      </p>
    </div>
  );
}

function Row({ label, value, mono, green }: { label: string; value: string; mono?: boolean; green?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span className={mono ? 'mono text-xs' : ''} style={{ color: green ? '#16A34A' : '#0F172A' }}>
        {value}
      </span>
    </div>
  );
}

function StepButton({
  stepNum, label, sublabel, isPending, isDone, isActive, isDisabled, onClick, primary,
}: {
  stepNum: number; label: string; sublabel: string; isPending: boolean; isDone: boolean;
  isActive: boolean; isDisabled: boolean; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled || isPending}
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all disabled:opacity-40"
      style={{
        background: isDone
          ? 'rgba(22,163,74,0.05)'
          : primary && isActive
          ? 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 50%, #F472B6 100%)'
          : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isDone
          ? '1px solid rgba(22,163,74,0.18)'
          : primary && isActive
          ? '1px solid rgba(255,255,255,0.30)'
          : isActive
          ? '1px solid rgba(56,189,248,0.35)'
          : '1px solid rgba(255,255,255,0.55)',
        cursor: isDisabled || isPending ? 'default' : 'pointer',
        boxShadow: primary && isActive
          ? '0 12px 28px rgba(56,189,248,0.28), 0 6px 16px rgba(244,114,182,0.18), inset 0 1px 1px rgba(255,255,255,0.25)'
          : 'inset 0 1px 1px rgba(255,255,255,0.65)',
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
        style={{
          background: isDone
            ? 'rgba(22,163,74,0.12)'
            : primary && isActive
            ? 'rgba(255,255,255,0.20)'
            : 'rgba(14,165,233,0.10)',
          color: isDone ? '#16A34A' : primary && isActive ? '#ffffff' : '#0EA5E9',
        }}
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : isDone ? <CheckCircle2 size={14} /> : stepNum}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: primary && isActive ? '#ffffff' : '#0F172A' }}>
          {isPending
            ? (stepNum === 1 ? 'Approving...' : 'Processing...')
            : label}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: primary && isActive ? 'rgba(255,255,255,0.70)' : '#94A3B8' }}>
          {sublabel}
        </p>
      </div>
    </button>
  );
}


function ErrorState({
  msg, txHash, chainId, isDbRecovery, onRetry, onRetryDbSave,
}: {
  msg: string;
  txHash: `0x${string}` | undefined;
  chainId: number;
  isDbRecovery: boolean;
  onRetry: () => void;
  onRetryDbSave: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-4 py-4"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(220,38,38,0.08)' }}
      >
        <AlertCircle size={24} style={{ color: '#DC2626' }} />
      </div>
      <p className="text-sm text-center leading-relaxed px-2" style={{ color: '#DC2626' }}>{msg}</p>
      {txHash && !isDbRecovery && (
        <a
          href={buildTxExplorerUrl(chainId, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: '#0EA5E9' }}
        >
          View tx on explorer <ExternalLink size={11} />
        </a>
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        {isDbRecovery ? (
          <button
            onClick={onRetryDbSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all btn-premium"
          >
            <RefreshCw size={14} />
            Retry Save
          </button>
        ) : (
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'rgba(14,165,233,0.06)',
              border: '1px solid rgba(14,165,233,0.22)',
              color: '#0EA5E9',
            }}
          >
            Try Again
          </button>
        )}
      </div>
    </motion.div>
  );
}

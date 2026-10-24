/**
 * Server-side viem client for sending on-chain transactions.
 *
 * The merchant wallet (owner of ArcEscrow) calls fulfillOrder(orderId),
 * which releases locked USDC from the escrow to owner().
 *
 * Requires MERCHANT_PRIVATE_KEY in .env — the private key of the deployer/owner
 * wallet (same address as VITE_MERCHANT_WALLET). Never prefix a private key with
 * VITE_ — Vite would ship it to the browser.
 *
 * If MERCHANT_PRIVATE_KEY is not set, on-chain calls return a descriptive error
 * so the DB-only fulfillment path still works for manual setups.
 */
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getChain, ONCHAIN_CHAINS } from '../../src/onchain-facts.js'

// Arc Testnet chain ID — import fact, never hardcode
const ARC_TESTNET_ID = ONCHAIN_CHAINS.find((c) => c.name === 'Arc Testnet')?.id ?? 1123334668

// RPC: prefer the provisioned proxy; fall back to the registry URL
const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map((s) => s.trim())
const arcProxyKey = 'Arc_Testnet'
const rpcUrl =
  process.env.RPC_PROXY_BASE_URL && proxyChains.includes(arcProxyKey)
    ? `${process.env.RPC_PROXY_BASE_URL}/api/rpc/${arcProxyKey}?_rpc_token=${process.env.RPC_PROXY_TOKEN}`
    : getChain(ARC_TESTNET_ID)?.rpcUrls.default.http[0]

const ESCROW_ADDRESS = process.env.VITE_ESCROW_ADDRESS as `0x${string}` | undefined

const ESCROW_ABI = parseAbi([
  'function fulfillOrder(bytes32 orderId) nonpayable',
])

const arcChain = getChain(ARC_TESTNET_ID)!

export const serverPublicClient = createPublicClient({
  chain: arcChain,
  transport: http(rpcUrl),
})

/** Call fulfillOrder on the escrow, releasing USDC to owner() (merchant wallet). */
export async function fulfillOnChain(externalOrderId: `0x${string}`): Promise<{
  success: boolean
  txHash?: string
  error?: string
}> {
  const pk = process.env.MERCHANT_PRIVATE_KEY

  if (!pk) {
    return {
      success: false,
      error:
        'MERCHANT_PRIVATE_KEY not set — DB updated but on-chain release skipped. ' +
        'Add the private key of the escrow owner wallet to .env as MERCHANT_PRIVATE_KEY.',
    }
  }

  if (!ESCROW_ADDRESS) {
    return { success: false, error: 'VITE_ESCROW_ADDRESS not configured' }
  }

  try {
    const account = privateKeyToAccount(pk as `0x${string}`)
    const walletClient = createWalletClient({
      account,
      chain: arcChain,
      transport: http(rpcUrl),
    })

    const txHash = await walletClient.writeContract({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'fulfillOrder',
      args: [externalOrderId],
    })

    const receipt = await serverPublicClient.waitForTransactionReceipt({ hash: txHash })

    return receipt.status === 'success'
      ? { success: true, txHash }
      : { success: false, error: `Transaction reverted — txHash: ${txHash}` }
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? 'Unknown error'
    return { success: false, error: msg }
  }
}

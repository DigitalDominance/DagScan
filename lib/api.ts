import axios from "axios"

interface RPCResponse<T = any> {
  jsonrpc: string
  id: number
  result?: T
  error?: {
    code: number
    message: string
  }
}

interface ContractInfo {
  isContract: boolean
  isVerified: boolean
  name?: string
  symbol?: string
  decimals?: number
  totalSupply?: string
  contractType?: "ERC20" | "ERC721" | "ERC1155" | "Other"
}

// Mock verified contracts registry - in a real app this would come from an API
const VERIFIED_CONTRACTS: Record<string, ContractInfo> = {
  "0xa0b86991c31cc0c0c0c0c0c0c0c0c0c0c0c0c0c0c": {
    isContract: true,
    isVerified: true,
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    contractType: "ERC20",
  },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": {
    isContract: true,
    isVerified: true,
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    contractType: "ERC20",
  },
  "0x6b175474e89094c44da98b954eedeac495271d0f": {
    isContract: true,
    isVerified: true,
    name: "Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
    contractType: "ERC20",
  },
}

// Mock data for when RPC is unavailable
const MOCK_DATA = {
  latestBlockNumber: 1234567,
  blocks: [
    {
      number: "0x12d687",
      hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      timestamp: "0x" + Math.floor(Date.now() / 1000).toString(16),
      transactions: ["0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"],
      gasUsed: "0x5208",
      gasLimit: "0x1c9c380",
      miner: "0x1234567890123456789012345678901234567890",
      parentHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      difficulty: "0x1bc16d674ec80000",
      size: "0x220",
    },
  ],
  transactions: [
    {
      hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      from: "0x1234567890123456789012345678901234567890",
      to: "0x0987654321098765432109876543210987654321",
      value: "0xde0b6b3a7640000",
      gasPrice: "0x4a817c800",
      gas: "0x5208",
      input: "0x",
      blockNumber: "0x12d687",
      blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      transactionIndex: "0x0",
      nonce: "0x1",
    },
  ],
  receipts: [
    {
      status: "0x1",
      gasUsed: "0x5208",
    },
  ],
}

class KasplexAPI {
  private rpcUrls: string[]
  private explorerApiUrls: string[]
  private chainId: number
  private currentRpcIndex = 0
  private useMockData = false
  public network: string
  public baseApiUrl = "https://api-explorer.kasplex.org/api/v2"

  constructor(_network: "kasplex" | "igra") {
    if (_network === "kasplex") {
      // Regular RPC nodes
      this.rpcUrls = [
        "https://evmrpc.kasplex.org/",
        // "https://kasplex-testnet.rpc.thirdweb.com/",
        // "https://testnet-rpc.kasplex.org/",
      ]

      // Explorer APIs that might have indexed transaction data
      this.explorerApiUrls = [
        'https://api-explorer.kasplex.org/api/v2',
        // "https://explorer-api.kasplextest.xyz/api",
        // "https://api.kasplextest.xyz/v1",
        // "https://testnet-api.kasplex.org/v1",
        // "https://kasplex-testnet-api.blockscout.com/api/v2",
      ]

      this.chainId = 202555
    } else {
      // this.rpcUrls = ["https://rpc.igra.xyz/"]
      // this.explorerApiUrls = ["https://api.igra.xyz/v1"]
      this.rpcUrls = ['https://caravel.igralabs.com:8545']
      this.explorerApiUrls=['https://explorer.caravel.igralabs.com/api/v2']
      this.chainId = 19416
    }
    this.baseApiUrl = this.explorerApiUrls[0]  
    this.network = _network  
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  private isValidTxHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash)
  }

  // Try explorer APIs first for indexed data
  private async explorerApiCall<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
    for (const baseUrl of this.explorerApiUrls) {
      try {
        const url = new URL(endpoint, baseUrl)
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value))
        })

        console.log(`🔍 Trying explorer API: ${url.toString()}`)

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(15000),
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Explorer API success: ${baseUrl}`)
          return data as T
        } else {
          console.warn(`❌ Explorer API failed: ${response.status} ${response.statusText}`)
        }
      } catch (error: any) {
        console.warn(`❌ Explorer API error for ${baseUrl}:`, error.message)
      }
    }
    return null
  }

  async rpcCall<T>(method: string, params: any[] = [], retries = 3): Promise<T> {
    if (this.useMockData) {
      return this.getMockResponse<T>(method, params)
    }

    let lastError: Error | null = null

    for (let rpcIndex = 0; rpcIndex < this.rpcUrls.length; rpcIndex++) {
      const rpcUrl = this.rpcUrls[rpcIndex]

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)

          const response = await fetch(rpcUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method,
              params,
              id: Date.now(),
            }),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data: RPCResponse<T> = await response.json()

          if (data.error) {
            throw new Error(`RPC Error: ${data.error.message}`)
          }

          this.currentRpcIndex = rpcIndex
          return data.result as T
        } catch (error: any) {
          lastError = error as Error
          console.warn(`RPC call failed for ${method} (attempt ${attempt + 1}/${retries}) on ${rpcUrl}:`, error.message)

          if (attempt < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500))
          }
        }
      }
    }

    console.error(`All RPC endpoints failed for ${method}. Switching to mock data mode.`)
    this.useMockData = true
    return this.getMockResponse<T>(method, params)
  }

  private getMockResponse<T>(method: string, params: any[]): T {
    switch (method) {
      case "eth_blockNumber":
        return `0x${MOCK_DATA.latestBlockNumber.toString(16)}` as T

      case "eth_getBlockByNumber":
        const blockNumber = params[0]
        const includeTransactions = params[1]
        const mockBlock = { ...MOCK_DATA.blocks[0] }

        if (blockNumber !== "latest") {
          const num = typeof blockNumber === "string" ? Number.parseInt(blockNumber, 16) : blockNumber
          mockBlock.number = `0x${num.toString(16)}`
        }

        if (!includeTransactions) {
          mockBlock.transactions = mockBlock.transactions.map((tx) => (typeof tx === "string" ? tx : tx))
        }

        return mockBlock as T

      case "eth_getTransactionByHash":
        return MOCK_DATA.transactions[0] as T

      case "eth_getTransactionReceipt":
        return MOCK_DATA.receipts[0] as T

      case "eth_gasPrice":
        return "0x4a817c800" as T

      case "eth_getBalance":
        return "0xde0b6b3a7640000" as T

      case "eth_getCode":
        return "0x" as T

      case "eth_getTransactionCount":
        return "0xa" as T

      case "eth_call":
        return "0x0" as T

      case "eth_getLogs":
        return [
          {
            address: "0x1234567890123456789012345678901234567890",
            topics: ["0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
            data: "0x",
            blockNumber: "0x12d687",
            transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            transactionIndex: "0x0",
            blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            logIndex: "0x0",
          },
        ] as T

      default:
        console.warn(`Mock response not implemented for method: ${method}`)
        return null as T
    }
  }

  private async getCode(address: string): Promise<string> {
    try {
      return await this.rpcCall<string>("eth_getCode", [address, "latest"])
    } catch (error) {
      return "0x"
    }
  }

  private async getContractInfo(address: string): Promise<ContractInfo> {
    if (!this.isValidAddress(address)) {
      return { isContract: false, isVerified: false }
    }

    const verified = VERIFIED_CONTRACTS[address.toLowerCase()]
    if (verified) {
      return verified
    }

    try {
      const code = await this.getCode(address)
      const isContract = code !== "0x" && code.length > 2

      if (isContract) {
        return {
          isContract: true,
          isVerified: false,
          contractType: "Other",
        }
      }

      return { isContract: false, isVerified: false }
    } catch (error) {
      console.error("Error getting contract info:", error)
      return { isContract: false, isVerified: false }
    }
  }

  private detectTransactionType(tx: any, receipt: any): string {
    if (!tx.to) {
      return "Contract Creation"
    }

    if (tx.input && tx.input !== "0x" && tx.input.length > 2) {
      const methodId = tx.input.slice(0, 10)

      const erc20Methods: Record<string, string> = {
        "0xa9059cbb": "Token Transfer",
        "0x23b872dd": "Token Transfer From",
        "0x095ea7b3": "Token Approval",
        "0x18160ddd": "Total Supply Call",
        "0x70a08231": "Balance Query",
        "0xdd62ed3e": "Allowance Query",
      }

      const erc721Methods: Record<string, string> = {
        "0x42842e0e": "NFT Transfer",
        "0x23b872dd": "NFT Transfer From",
        "0x6352211e": "NFT Owner Query",
        "0x081812fc": "NFT Approval Query",
      }

      const defiMethods: Record<string, string> = {
        "0x7ff36ab5": "Swap KAS→Tokens",
        "0x18cbafe5": "Swap Tokens→KAS",
        "0x38ed1739": "Swap Tokens",
        "0xb6f9de95": "Swap KAS→Tokens",
        "0xe8e33700": "Add Liquidity",
        "0x02751cec": "Remove Liquidity",
        "0xa694fc3a": "Stake",
        "0x2e1a7d4d": "Withdraw",
      }

      if (erc20Methods[methodId]) return erc20Methods[methodId]
      if (erc721Methods[methodId]) return erc721Methods[methodId]
      if (defiMethods[methodId]) return defiMethods[methodId]

      return "Contract Call"
    }

    if (tx.value && tx.value !== "0x0") {
      return "KAS Transfer"
    }

    return "Transaction"
  }

  async getLatestBlockNumber(): Promise<number> {
    const result = await this.rpcCall<string>("eth_blockNumber")
    return Number.parseInt(result, 16)
  }

  async getBlock(blockNumber: number | "latest", includeTransactions = false): Promise<any> {
    const blockParam = blockNumber === "latest" ? "latest" : `0x${blockNumber.toString(16)}`
    return await this.rpcCall("eth_getBlockByNumber", [blockParam, includeTransactions])
  }

  async getTransaction(txHash: string): Promise<any> {
    return await this.rpcCall("eth_getTransactionByHash", [txHash])
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    return await this.rpcCall("eth_getTransactionReceipt", [txHash])
  }

  async getGasPrice(): Promise<string> {
    const result = await this.rpcCall<string>("eth_gasPrice")
    return (Number.parseInt(result, 16) / 1e9).toFixed(2)
  }

  async getBalance(address: string): Promise<string> {
    const result = await this.rpcCall<string>("eth_getBalance", [address, "latest"])
    return (Number.parseInt(result, 16) / 1e18).toFixed(4)
  }

  async getNetworkStats() {
    try {
      const [latestBlockNumber, gasPrice] = await Promise.all([this.getLatestBlockNumber(), this.getGasPrice()])

      const latestBlock = await this.getBlock(latestBlockNumber, true)

      const blockPromises = []
      for (let i = 0; i < 5; i++) {
        blockPromises.push(this.getBlock(latestBlockNumber - i))
      }

      const blocks = await Promise.all(blockPromises)
      const blockTimes = []

      for (let i = 0; i < blocks.length - 1; i++) {
        const timeDiff = Number.parseInt(blocks[i].timestamp, 16) - Number.parseInt(blocks[i + 1].timestamp, 16)
        blockTimes.push(timeDiff)
      }

      const avgBlockTime = blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : 12

      return {
        latestBlock: latestBlockNumber,
        totalTransactions: latestBlock.transactions?.length || 0,
        avgBlockTime: avgBlockTime,
        gasPrice,
      }
    } catch (error) {
      console.error("Failed to fetch network stats:", error)
      return {
        latestBlock: MOCK_DATA.latestBlockNumber,
        totalTransactions: 15,
        avgBlockTime: 12.5,
        gasPrice: "20.00",
      }
    }
  }

  async getLatestBlocks(count = 10): Promise<any[]> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/main-page/blocks`, {
        count,
        network: this.network
      });

      const latestBlocks = response.data.blocks;

      return latestBlocks;
    } catch (error) {
      return Array.from({ length: count }, (_, i) => ({
        number: MOCK_DATA.latestBlockNumber - i,
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        timestamp: Date.now() - i * 12000,
        transactions: Math.floor(Math.random() * 50),
        gasUsed: "21000",
        gasLimit: "30000000",
        miner: "0x1234567890123456789012345678901234567890",
      }))
    }
  }

  async getLatestTransactions(count = 15): Promise<any[]> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/main-page/transactions`, {
        count,
        network: this.network
      });

      const latestTransactions = response.data.transactions;

      return latestTransactions;
    } catch (error) {
      console.error("Failed to fetch latest transactions:", error)
      return Array.from({ length: count }, () => ({
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        toInfo: { isContract: false, isVerified: false },
        value: (Math.random() * 10).toFixed(4),
        gasPrice: (20 + Math.random() * 50).toFixed(2),
        timestamp: Date.now() - Math.random() * 3600000,
        status: Math.random() > 0.1 ? "success" : "failed",
        type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
        input: "0x",
      }))
    }
  }

  // NEW: Ultra-fast address transaction history using Kasplex Frontend API
  async getAddressTransactionHistory(address: string, limit = 100): Promise<any[]> {
    try {
      const respnse = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/details/address/transaction_history`, {
        address,
        limit,
        network: this.network
      });

      const transactionHistory = respnse.data.transactionHistory;

      return transactionHistory;
    } catch (error: any) {
      console.error("❌ Kasplex Frontend API failed:", error.message)

      // Fallback to mock data instead of complex RPC calls
      console.log("🔄 Using fallback mock data")
      return Array.from({ length: Math.min(10, limit) }, (_, i) => ({
        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        value: (Math.random() * 10).toFixed(4),
        gasPrice: (20 + Math.random() * 50).toFixed(2),
        timestamp: Date.now() - i * 3600000,
        status: Math.random() > 0.1 ? "success" : "failed",
        type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
        method: "",
        blockNumber: 1234567 - i,
        gasUsed: "21000",
        fromInfo: { isContract: false, isVerified: false },
        toInfo: { isContract: false, isVerified: false },
      }))
    }
  }

  // NEW: Get token balances for an address
  async getAddressTokenBalances(address: string): Promise<any[]> {
    try {
      const respnse = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/details/address/transaction_history`, {
        address,
        network: this.network
      });

      const tokenBalances = respnse.data.tokenBalances;

      return tokenBalances;      
    } catch (error) {
      console.error("Failed to get token balances:", error)
      return []
    }
  }

  // NEW: Get token transfers for an address
  async getAddressTokenTransfers(address: string, limit = 50): Promise<any[]> {
    try {
      const respnse = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/details/address/token_transfers`, {
        address,
        limit,
        network: this.network
      });

      const tokenTransfers = respnse.data.tokenTransfers;

      return tokenTransfers;  
    } catch (error) {
      console.error("Failed to get token transfers:", error)
      return []
    }
  }

  // NEW: Get NFTs for an address
  async getAddressNFTs(address: string, limit = 50): Promise<any[]> {
    try {
      const respnse = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/details/address/nfts`, {
        address,
        limit,
        network: this.network
      });

      const nfts = respnse.data.nfts;

      return nfts;  
    } catch (error) {
      console.error("Failed to get NFTs:", error)
      return []
    }
  }

  async getAddressDetails(address: string): Promise<any> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/details/address`, {
        network: this.network, 
        address
      })
  
      const addressDetails = response.data.addressDetails;

      return addressDetails;
    } catch (error) {
      throw error
    }

  }

  async searchByHash(query: string): Promise<any> {
    const cleanQuery = query.trim()

    if (this.isValidAddress(cleanQuery)) {
      return await this.getAddressDetails(cleanQuery)
    } else if (this.isValidTxHash(cleanQuery)) {
      try {
        const tx = await this.getTransaction(cleanQuery)
        if (tx) {
          const receipt = await this.getTransactionReceipt(cleanQuery)
          const txType = this.detectTransactionType(tx, receipt)

          let fromInfo: ContractInfo | null = null
          let toInfo: ContractInfo | null = null

          if (tx.from && this.isValidAddress(tx.from)) {
            try {
              fromInfo = await this.getContractInfo(tx.from)
            } catch (error) {
              console.error("Error getting from address contract info:", error)
              fromInfo = { isContract: false, isVerified: false }
            }
          }
          if (tx.to && this.isValidAddress(tx.to)) {
            try {
              toInfo = await this.getContractInfo(tx.to)
            } catch (error) {
              console.error("Error getting to address contract info:", error)
              toInfo = { isContract: false, isVerified: false }
            }
          }

          return {
            type: "transaction",
            ...tx,
            fromInfo,
            toInfo,
            status: receipt?.status === "0x1" ? "success" : "failed",
            gasUsed: receipt?.gasUsed || "0",
            timestamp: Date.now(),
            txType,
          }
        }
      } catch (error) {
        console.error("Transaction not found, trying as block hash:", error)
        try {
          const block = await this.rpcCall("eth_getBlockByHash", [cleanQuery, true])
          if (block) {
            return {
              type: "block",
              number: Number.parseInt((block as any).number, 16),
              hash: (block as any).hash,
              timestamp: Number.parseInt((block as any).timestamp, 16) * 1000,
              transactions: (block as any).transactions || [],
              gasUsed: (block as any).gasUsed || "0",
              gasLimit: (block as any).gasLimit || "0",
              miner: (block as any).miner || "0x0000000000000000000000000000000000000000",
              parentHash: (block as any).parentHash || "",
              difficulty: (block as any).difficulty || "0",
              size: (block as any).size || "0",
            }
          }
        } catch (blockError) {
          console.error("Not a valid block hash:", blockError)
        }
      }
    } else if (/^\d+$/.test(cleanQuery)) {
      try {
        const blockNumber = Number.parseInt(cleanQuery)
        const block = await this.getBlock(blockNumber, true)
        if (block) {
          return {
            type: "block",
            number: Number.parseInt(block.number, 16),
            hash: block.hash,
            timestamp: Number.parseInt(block.timestamp, 16) * 1000,
            transactions: block.transactions || [],
            gasUsed: block.gasUsed || "0",
            gasLimit: block.gasLimit || "0",
            miner: block.miner || "0x0000000000000000000000000000000000000000",
            parentHash: block.parentHash || "",
            difficulty: block.difficulty || "0",
            size: block.size || "0",
          }
        }
      } catch (error) {
        console.error("Invalid block number:", error)
      }
    }

    throw new Error("Invalid search query format")
  }

  async getBlockDetails(blockNumber: number): Promise<any> {
    try {
      const block = await this.getBlock(blockNumber, true)
      return {
        type: "block",
        number: Number.parseInt(block.number, 16),
        hash: block.hash,
        timestamp: Number.parseInt(block.timestamp, 16) * 1000,
        transactions: block.transactions || [],
        gasUsed: block.gasUsed || "0",
        gasLimit: block.gasLimit || "0",
        miner: block.miner || "0x0000000000000000000000000000000000000000",
        parentHash: block.parentHash || "",
        difficulty: block.difficulty || "0",
        size: block.size || "0",
      }
    } catch (error) {
      console.error("Failed to get block details:", error)
      throw error
    }
  }

  async getTransactionDetails(txHash: string): Promise<any> {
    try {
      const [tx, receipt] = await Promise.all([this.getTransaction(txHash), this.getTransactionReceipt(txHash)])

      if (!tx) throw new Error("Transaction not found")

      const block = await this.getBlock(Number.parseInt(tx.blockNumber, 16))
      const txType = this.detectTransactionType(tx, receipt)

      let fromInfo: ContractInfo | null = null
      let toInfo: ContractInfo | null = null

      if (tx.from) {
        try {
          fromInfo = await this.getContractInfo(tx.from)
        } catch (error) {
          fromInfo = { isContract: false, isVerified: false }
        }
      }
      if (tx.to) {
        try {
          toInfo = await this.getContractInfo(tx.to)
        } catch (error) {
          toInfo = { isContract: false, isVerified: false }
        }
      }

      return {
        type: "transaction",
        hash: tx.hash,
        from: tx.from,
        fromInfo,
        to: tx.to || "Contract Creation",
        toInfo,
        value: (Number.parseInt(tx.value || "0", 16) / 1e18).toFixed(4),
        gasPrice: (Number.parseInt(tx.gasPrice || "0", 16) / 1e9).toFixed(2),
        gasUsed: receipt?.gasUsed || "0",
        gasLimit: tx.gas || "0",
        timestamp: Number.parseInt(block.timestamp, 16) * 1000,
        status: receipt?.status === "0x1" ? "success" : "failed",
        blockNumber: Number.parseInt(tx.blockNumber, 16),
        blockHash: tx.blockHash,
        transactionIndex: Number.parseInt(tx.transactionIndex, 16),
        nonce: tx.nonce,
        input: tx.input || "0x",
        txType,
      }
    } catch (error) {
      console.error("Failed to get transaction details:", error)
      throw error
    }
  }

  // NEW: Get smart contract details using the new API endpoints
  async getSmartContractDetails(address: string): Promise<any> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/details/contract`, {
        network: this.network, 
        address
      })
  
      const smartcontractDetails = response.data.smartcontractDetails;

      return smartcontractDetails;      
    } catch (error) {
      console.error("Failed to get smart contract details:", error)
      return null
    }
  }

  // NEW: Get token info using the new API endpoints
  async getTokenInfo(address: string): Promise<any> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/token/info`, {
        network: this.network, 
        address
      })
  
      const tokenInfo = response.data.tokenInfo;

      return tokenInfo;        
    } catch (error) {
      console.error("Failed to get token info:", error)
      return null
    }
  }

  // NEW: Get contract source code
  async getContractCode(address: string): Promise<{ code: string } | null> {
    try {
      // First try to get smart contract details which includes source code
      const contractDetails = await this.getSmartContractDetails(address)

      if (contractDetails?.source_code) {
        return { code: contractDetails.source_code }
      }

      // Fallback to RPC call for bytecode
      const code = await this.rpcCall<string>("eth_getCode", [address, "latest"])

      if (code && code !== "0x" && code.length > 2) {
        return { code }
      }

      return null
    } catch (error) {
      console.error("Failed to get contract code:", error)
      return null
    }
  }

  // NEW: Get contract metadata (token info, etc.)
  async getContractMetadata(address: string): Promise<any> {
    try {
      // Try to get both smart contract details and token info
      const [contractDetails, tokenInfo] = await Promise.all([
        this.getSmartContractDetails(address),
        this.getTokenInfo(address),
      ])

      return {
        // Smart contract specific data
        isVerified: contractDetails?.is_verified || false,
        isFullyVerified: contractDetails?.is_fully_verified || false,
        compilerVersion: contractDetails?.compiler_version,
        language: contractDetails?.language,
        optimizationEnabled: contractDetails?.optimization_enabled,
        verifiedAt: contractDetails?.verified_at,
        abi: contractDetails?.abi,
        constructorArgs: contractDetails?.constructor_args,

        // Token specific data
        totalSupply: tokenInfo?.total_supply,
        decimals: tokenInfo?.decimals,
        holders: tokenInfo?.holders,
        exchangeRate: tokenInfo?.exchange_rate,
        circulatingMarketCap: tokenInfo?.circulating_market_cap,
        iconUrl: tokenInfo?.icon_url,

        // Combined metadata
        name: contractDetails?.name || tokenInfo?.name,
        symbol: tokenInfo?.symbol,
        type: tokenInfo?.type,

        // Additional contract info
        createdAt: contractDetails?.verified_at,
        ...contractDetails,
        ...tokenInfo,
      }
    } catch (error) {
      console.error("Failed to get contract metadata:", error)
      return {}
    }
  }

  // NEW: Get token holders for a contract
  async getTokenHolders(address: string, limit = 50): Promise<{ holders: any[] }> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/token/holders`, {
        network: this.network, 
        address,
        limit
      })
  
      const holdersData = response.data.holdersData;

      return { holders: holdersData };         
    } catch (error) {
      console.error("Failed to get token holders:", error)
      return { holders: [] }
    }
  }

  // NEW: Get NFTs from a contract collection
  async getContractNFTs(address: string, limit = 50): Promise<{ nfts: any[] }> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/contract/nft`, {
        network: this.network, 
        address,
        limit
      })
  
      const nftData = response.data.nftData;

      return { nfts: nftData }
    } catch (error) {
      console.error("Failed to get contract NFTs:", error)
      return { nfts: [] }
    }
  }

  // NEW: Get token transfers for a contract
  async getTokenTransfers(address: string, limit = 50): Promise<any[]> {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/token/transfers`, {
        network: this.network, 
        address,
        limit
      })
  
      const transfers = response.data.transfers;

      return transfers
    } catch (error) {
      console.error("Failed to get token transfers:", error)
      return []
    }
  }

  isUsingMockData(): boolean {
    return this.useMockData
  }

  async resetConnection(): Promise<void> {
    this.useMockData = false
    this.currentRpcIndex = 0
    try {
      await this.getLatestBlockNumber()
      console.log("Successfully reconnected to RPC")
    } catch (error) {
      console.log("Still unable to connect to RPC, continuing with mock data")
    }
  }
}

export { KasplexAPI }
export type { ContractInfo }

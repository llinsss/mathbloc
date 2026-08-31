# MathBloc 🎮

An educational math game for children aged 2–9 with an on-chain reward system deployed on **Celo**.

## Live Features

- Progressive math learning (number recognition → division)
- AI tutor that adapts difficulty based on performance
- Practice, Challenge (timed), and Story modes
- Coins, stars, badges, confetti rewards
- Parent dashboard with per-topic progress tracking
- **On-chain**: player registration, daily activity tracking, streaks, CELO rewards, leaderboard

---

## Tech Stack & Runtime Requirements

| Layer | Tech |
|---|---|
| Runtime | Node.js `>=20.9.0` (pinned via `.nvmrc` `20`), npm `>=10.0.0` |
| Frontend | Next.js 16, React 19, Tailwind CSS |
| State | Zustand (persisted to localStorage) |
| Smart Contract | Solidity 0.8.24, Hardhat 2 |
| Blockchain | Celo (Alfajores testnet / Mainnet) |
| Wallet | MetaMask / any EIP-1193 wallet |

---

## Getting Started

### 1. Prerequisites
Ensure you are using the supported Node.js and npm versions:
```bash
nvm use
# Node >= 20.9.0, npm >= 10.0.0
```

### 2. Install dependencies
```bash
npm ci
```

### 3. Set up environment
```bash
cp .env.example .env.local
# Fill in your DEPLOYER_PRIVATE_KEY
```

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

---

## Local Validation (Matches CI)

Run the full local validation sequence matching the CI workflow:

```bash
npm ci && npm run lint && npm run type-check && npm test && npm run test:network && npm run compile && npm run test:contracts && npm run test:coverage && npm run build
```

### Individual Test Commands

- **Frontend unit & component tests**: `npm test`
- **TypeScript type checking**: `npm run type-check`
- **ESLint**: `npm run lint`
- **Network configuration tests**: `npm run test:network`
- **Compile smart contracts**: `npm run compile`
- **Smart contract tests**: `npm run test:contracts`
- **Smart contract coverage**: `npm run test:coverage`
- **Production build**: `npm run build`

---

## Smart Contract

### Contract: `MathBlocGame.sol`

Deployed on **Celo Alfajores Testnet**.

#### Key functions

| Function | Description |
|---|---|
| `register(username)` | Register a player wallet |
| `recordActivity(score, correct, attempts, topic)` | Record a daily game session |
| `claimCeloReward()` | Claim 0.001 CELO when coins ≥ 100 |
| `getLeaderboard(n)` | Get top N players by score |
| `isActiveToday(addr)` | Check if player was active today |
| `getTodayActivePlayers()` | All wallets active today |
| `fundRewardPool()` | Owner deposits CELO for rewards |

#### Reward logic
- **+10 coins** every day you play
- **+20 coins** for a perfect score (10/10)
- **+5 coins × (streak ÷ 7)** every 7-day streak milestone
- **0.001 CELO** claimable when coins reach 100

### Compile
```bash
npm run compile
```

### Test & Coverage
```bash
npm run test:contracts
npm run test:coverage
```

### Deploy to Alfajores (testnet)
```bash
npm run deploy:alfajores
```
> Get free testnet CELO at https://faucet.celo.org/alfajores

### Deploy to Celo Mainnet
```bash
npm run deploy:celo
```

After deployment, `lib/contract.json` is auto-generated with the ABI and address — the frontend loads it automatically.

---

## Daily Activity (Cron)

The `daily-activity.ts` script:
1. Prints today's active player count
2. Shows the top-5 leaderboard
3. Records a keeper ping on-chain
4. Refills the reward pool if low

### Run manually
```bash
npm run daily
```

### Schedule with cron (runs every day at 9am)
```bash
crontab -e
# Add:
0 9 * * * cd /path/to/math && npm run daily >> logs/daily.log 2>&1
```

---

## Project Structure

```
mathbloc/
├── app/                    # Next.js pages
│   ├── page.tsx            # Home / profile select
│   ├── game/               # Game hub + modes
│   └── dashboard/          # Parent dashboard
├── components/
│   ├── game/               # PracticeMode, ChallengeMode, StoryMode
│   ├── dashboard/          # ProfileSelector, ParentDashboard, Web3Panel
│   └── ui/                 # Mascot, Timer, Confetti, RewardBar
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── store.ts            # Zustand state
│   ├── questionEngine.ts   # Dynamic question generator
│   ├── aiTutor.ts          # Adaptive difficulty logic
│   ├── data.ts             # Story chapters, badges, TTS
│   ├── useContract.ts      # ethers.js contract hook
│   └── contract.json       # Auto-generated after deploy
├── contracts/
│   ├── contracts/
│   │   └── MathBlocGame.sol
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── daily-activity.ts
│   └── test/
│       └── MathBlocGame.test.ts
└── tests/                  # Frontend unit & regression tests
```

---

## Contract Address

**Celo Mainnet:** `0xCcA8f0878E703425Ec8000d38aDbEDaCD10F5d7d`

Check on CeloScan: https://celoscan.io/address/0xCcA8f0878E703425Ec8000d38aDbEDaCD10F5d7d

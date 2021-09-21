/**
 *Submitted for verification at BscScan.com on 2021-05-01
*/

/**
 *Submitted for verification at BscScan.com on 2021-04-24
*/

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor () {
        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }
    function owner() public view virtual returns (address) {
        return _owner;
    }
    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// Interface for BOG token
interface IBogged {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IReceivesBogRand {
    function receiveRandomness(uint256 random) external;
}

interface IBogRandOracle {
    function requestRandomness() external;
    
    function getNextHash() external view returns (bytes32);
    function getPendingRequest() external view returns (address);
    function removePendingRequest(address adr, bytes32 nextHash) external;
    function provideRandomness(uint256 random, bytes32 nextHash) external;
    function seed(bytes32 hash) external;
}

interface IPancakeRouter01 {
    function WETH() external pure returns (address);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
}

interface IPancakeRouter02 is IPancakeRouter01 {
}

interface IPancakeRouter is IPancakeRouter02 {}

/**
 * Bingus SweepStakes Contract v0.1
 * Players lock LP tokens in return for a chance to win Bingus tokens.
 */
contract BingusSweepStakes is Ownable,IReceivesBogRand {    
    uint256 public ENTRY_INCREMENT = 2 * 10 ** 16; // entries must be in .02 LP increments, adjustable
    uint256 public MAXIMIUM_POOL_SIZE = 1000 * 10 ** 18; // 1000 LP token max pool size, adjustable
    uint256 public MAXIMUM_ENTRIES = 5000; // 5000 entrants max as a precaution, adjustable
    
    struct LockedTokens {
        uint tokenCount; // how many tokens were locked
        uint expiryTimestamp; // when tokens can be withdrawn
    }
        
    struct Winner {
        address playerAddress;
        uint256 bnbAmount;
    }
    
    event WinnerResult(
        address indexed winner,
        uint256 indexed totalStake
    );
    
    event WaitingForRandom();
    
    enum LOTTERY_STATE { OPEN, PICKING_WINNER, WAITING_RANDOM, REWARDING_WINNER, CLOSED }
    LOTTERY_STATE public lotteryState;
    
    // ADDRESSES
    // TEST NET ADDRESSES
    address private constant BINGUS_TOKEN_ADDRESS = 0xbcca17a1e79Cb6Fcf2A5B7433e6fBCb7408Ca535;
    address private constant BINGUS_LP_TOKEN_ADDRESS = 0x864A2967FA8E01fd60a951a63493642586bDBBd5;
        
    IERC20 private tokenContract;
    IERC20 private lpTokenContract;
    address[] private players;
    uint256 private numPlayers;
    Winner[] private winners;
    uint256 private openTimestamp;
    uint256 private lotteryPoolSize;
    mapping(address => LockedTokens[]) public lockedLiqTokens;
    
    // LOTTERY TIME VALUES
    uint256 public LOTTERY_RUN_TIME = 60 * 10 * 24 * 2; // 2 day in seconds, adjustable
    uint256 public LOCK_PERIOD      = 60 * 10; // seconds * minutes * hours * days, adjustable
    
    // BogRNG Oracle
    IBogRandOracle private oracle;
    address private constant oracleAddress = 0x3886F3f047ec3914E12b5732222603f7E962f5Eb;
    address private constant bog = 0xD7B729ef857Aa773f47D37088A1181bB3fbF0099;
    uint256 private random;
    uint256 public MAXIMUM_ORACLE_FEE = .5 * 10 ** 17; // .5 BOG maximum fee per winning pick
    uint256 private ORACLE_WAIT_TIME = 60 * 60 * 2; // 2 hours in seconds
    bool public oracleDoReward = false;
    
    constructor() {
        // Bingus contract address
        tokenContract = IERC20(BINGUS_TOKEN_ADDRESS);
        lpTokenContract = IERC20(BINGUS_LP_TOKEN_ADDRESS);
        
        oracle = IBogRandOracle(oracleAddress);
        
        resetPool();
        lotteryState = LOTTERY_STATE.CLOSED;
    }
    
    /**
     * Reset lottery pool. Lottery state should be set to CLOSED right after.
     */
    function resetPool() private {
        clearPlayers();
        lotteryPoolSize = 0;
        random = 0;
        
        // Re-approve oracle to spend BOG from this contract so fees can be taken
        // IBogged(bog).approve(address(oracle), MAXIMUM_ORACLE_FEE);
    }
    
    function openLottery() public onlyOwner {
        require(lotteryState == LOTTERY_STATE.CLOSED, "LotteryState must be CLOSED to OPEN.");
        lotteryState = LOTTERY_STATE.OPEN;
        openTimestamp = block.timestamp;
    }
    
    function updateEntryConstants(uint maxPoolSize, uint maxEntries) public onlyOwner {
        if (maxPoolSize > 0) {
            MAXIMIUM_POOL_SIZE = maxPoolSize;
        }
        if (maxEntries > 0) {
            MAXIMUM_ENTRIES = maxEntries;
        }
    }
    
    function updateEntryIncrement(uint increment) public onlyOwner {
        require(increment > 0, "increment must be greater than 0.");
        ENTRY_INCREMENT = increment;
    }
    
    function updateMaxOracleFee(uint fee) public onlyOwner {
        require(fee > 0, "Max Oracle fee must be greater than 0.");
        MAXIMUM_ORACLE_FEE = fee;
    }
    
    function updateLotteryRunTime(uint runtime) public onlyOwner {
        require(runtime > 0, "Runtime must be greater than 0.");
        LOTTERY_RUN_TIME = runtime;
    }
    
    function updateLockPeriod(uint lockperiod) public onlyOwner {
        require(lockperiod > 0, "Lock period must be greater than 0.");
        LOCK_PERIOD = lockperiod;
    }
    
    function updateOracleDoReward(bool doReward) public onlyOwner {
        oracleDoReward = doReward;
    }
    
    /**
     * Helper function to avoid expensive array deletion
     */
    function addPlayer(address player) private {
        assert(numPlayers <= players.length);
        if (numPlayers == players.length) {
            players.push(player);
        } else {
            players[numPlayers] = player;
        }
        numPlayers++;
    }
    
    /**
     * Helper function to avoid expensive array deletion
     */
    function clearPlayers() private {
        numPlayers = 0;
    }
    
    /**
     * Enter the lottery.
     * The caller must have approved this contract to spend Bingus LP tokens in advance.
     * This can cause a state transition to PICKING_WINNER if the current timestamp passes the lottery run time.
     */
    function enter(uint256 amount_) external {
        require(lotteryState == LOTTERY_STATE.OPEN, "The lottery is not open.");
        require(lotteryPoolSize < MAXIMIUM_POOL_SIZE, "The lottery has reached max pool size.");
        require(players.length <= MAXIMUM_ENTRIES, "The lottery has reached max number of entries.");
        
        // restrict to entry increments to prevent massive arrays
        require(amount_ >= ENTRY_INCREMENT, "Entry amount less than minimum.");
        require(amount_ % ENTRY_INCREMENT == 0, "Entry must be in increments of ENTRY_INCREMENT.");
        
        require(lpTokenContract.transferFrom(msg.sender, address(this), amount_), "Failed to transfer tokens from your address.");
        
        for (uint i = 0; i < amount_ / ENTRY_INCREMENT; i++) {
            addPlayer(msg.sender);
        }
        
        lotteryPoolSize = lotteryPoolSize + amount_;
        
        // persist liquidity amount and expiry timestamp
        LockedTokens memory lock;
        lock.tokenCount = amount_;
        lock.expiryTimestamp = block.timestamp + (LOCK_PERIOD);
        lockedLiqTokens[msg.sender].push(lock);
        
        if (block.timestamp > openTimestamp + LOTTERY_RUN_TIME) {
            lotteryState = LOTTERY_STATE.PICKING_WINNER;
            pickWinner();
        }
    }
    
    /**
     * Pick the winner by requesting a random number.
     * The PICKING_WINNER state can be triggered by enter() or by calling pickWinner() directly.
     * This method calls the BogRNG Oracle to generate a new random number. rewardWinner() must be called
     * manually after the BogRNG Oracle supplies the random number.
     */
    function pickWinner() public {
        if (lotteryState == LOTTERY_STATE.OPEN && block.timestamp > openTimestamp + LOTTERY_RUN_TIME) {
            lotteryState = LOTTERY_STATE.PICKING_WINNER;
        }
        require(lotteryState == LOTTERY_STATE.PICKING_WINNER, "The lottery is not picking winner.");
        // require(IBogged(bog).balanceOf(address(this)) > MAXIMUM_ORACLE_FEE, "Contract address needs more BOG.");
        
        // Do not allow state transition to WAITING_RANDOM if no players
        if (numPlayers == 0) {
            resetPool();
            lotteryState = LOTTERY_STATE.CLOSED;
            return;
        }
        
        refreshRandomNumber();
        emit WaitingForRandom();
        lotteryState = LOTTERY_STATE.WAITING_RANDOM;
    }
    
    /**
     * Refresh the random number by requesting a new random number from the BogRNG oracle
     */
    function refreshRandomNumber() private {
        // TESTNET DO NOTHING
        // IBogRandOracle(oracle).requestRandomness();
    }
    
    /**
     * Randomness callback function by the BogRNG oracle
     */
    function receiveRandomness(uint256 random_) external override {
        // TESTNET ALLOW ANY RANDOMNESS TO BE RECEIVED
        //require(msg.sender == oracleAddress); // Ensure the sender is the oracle

        // lottery already received a random number (maybe an override), ignore callback
        if (lotteryState != LOTTERY_STATE.WAITING_RANDOM) {
            return;
        }
        
        random = random_; // Store random number
        
        lotteryState = LOTTERY_STATE.REWARDING_WINNER;
        // Be wary of max gas usage of BogRNG Oracle callback.
        if (oracleDoReward) {
            rewardWinner();
        }
    }
    
    /**
     * Fallback mechanism if BogRNG oracle has not called back after a 2 hour waiting period or if callback fails for other reason.
     * This is not ideal, but the winning index is a hash of supplied random, block.timestamp, and block.difficulty.
     * This should be sufficiently difficult to game. Contract owner cannot predict exact timestamp/difficulty,
     * and miners can't predict the supplied random.
     * TODO: a decentralized way of handling this scenario
     */
    function receiveRandomnessOverride(uint256 random_) external onlyOwner {
        require(lotteryState == LOTTERY_STATE.WAITING_RANDOM, "Lottery is not waiting for a random number.");
        // wait 2 hours minimum for oracle callback
        require(block.timestamp > openTimestamp + LOTTERY_RUN_TIME + ORACLE_WAIT_TIME, "Minimum wait time for Oracle not met.");
        
        random = random_; // Store random number
        
        lotteryState = LOTTERY_STATE.REWARDING_WINNER;
    }
    
    /**
     * Select and reward the winner.
     * This can only be executed after the BogRNG Oracle has called back to receiveRandomness().
     */
    function rewardWinner() public {
        require(lotteryState == LOTTERY_STATE.REWARDING_WINNER, "The lottery is not rewarding winner.");

        // 256 bit wide result of keccak256 is always greater than the number of players
        uint index = uint256(keccak256(abi.encodePacked(random, block.timestamp, block.difficulty))) % numPlayers;

        address winningAddress = players[index];
        
        // Send Bingus to winner
        uint contractBalance = tokenContract.balanceOf(address(this));
        require(tokenContract.transfer(winningAddress, contractBalance));
        
        // Winning address and pool amount saved
        winners.push(Winner(winningAddress, contractBalance));
        emit WinnerResult(winningAddress, contractBalance);
        
        resetPool();
        lotteryState = LOTTERY_STATE.CLOSED;
    }
    
    /**
     * Allow withdrawal of liquidity tokens after lock period ends.
     * If lock period is shorter than lottery length, then a player will be able to enter again in the same lottery.
     */
    function withdrawLiquidityTokens(uint256 index) public {
        require(lockedLiqTokens[msg.sender][index].expiryTimestamp < block.timestamp, "Liquidity Tokens still locked.");
        uint256 amount = lockedLiqTokens[msg.sender][index].tokenCount;
        lockedLiqTokens[msg.sender][index].tokenCount = 0;
        require(lpTokenContract.transfer(address(msg.sender), amount));
    }
    
    /**
     * Allow withdrawal of reward token amount and any BNB in the address
     */
    function withdrawRewardTokens(uint256 amount) public payable onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
        require(tokenContract.transfer(owner(), amount));
    }
    
    function getLockedLiquidityForAddress(address address_) external view returns (LockedTokens[] memory) {
        return lockedLiqTokens[address_];
    }
    
    function getNumPlayers() public view returns (uint256) {
        return numPlayers;
    }
    
    function getPlayers() public view returns (address[] memory) {
        return players;
    }
    
    function getWinners() public view returns (Winner[] memory) {
        return winners; // historical winners
    }
    
    function getTotalLockedLp() public view returns (uint256) {
        return lotteryPoolSize;
    }
    
    function getWinningPoolSize() public view returns (uint256) {
        return tokenContract.balanceOf(address(this));
    }
    
    function getOpenTimestamp() public view returns (uint256) {
        return openTimestamp;
    }
}
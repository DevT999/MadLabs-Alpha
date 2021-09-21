```
interface MadCredits is IBEP20, Ownable {
    event AllocatedMarketingFunds(address to, uint256 amount);
    event ExcludedFromFeesAsRecipientSet(address indexed account, bool whitelisted);
    event ExcludedFromFeesAsSenderSet(address indexed account, bool whitelisted);
    event LiquidityThresholdSet(uint256 amount);
    event SwapRouterSet(address indexed router);
    event LiquidityTokenDestinationSet(address indexed destination);
    event SwappedAndAddedLiquidity(uint256 tokenUsed, uint256 ethUsed, uint256 liquidityAmountAdded, address indexed liquidityTokenDestination);
    event DividendsClaimed(address indexed account, uint256 amount);
    event FeesTaken(uint256 burned, uint256 dividendFee, uint256 liquidityFee, uint256 marketingFee);

    // In basis points (i.e. 1% = 100, 0.01% = 1)
    function dividendFeeRate() external view returns (uint256);
    function liquidityFeeRate() external view returns (uint256);
    function burnFeeRate() external view returns (uint256);
    function marketingFeeRate() external view returns (uint256);

    function totalDividendsAccumulated() external view returns (uint256);
    function marketingFeeBalance() external view returns (uint256);

    function swapRouter() external view returns (address);
    function liquidityTokenDestination() external view returns (address);

    function liquidityThreshold() external view returns (uint256);

    function isExcludedFromFeesAsRecipient(address account) external view returns (bool);
    function isExcludedFromFeesAsSender(address account) external view returns (bool);

    function nftAddress() external view returns (address);

    function dividendsClaimedBy(uint256 tokenId) external view returns (uint256);

    function getOwner() external view override returns (address);

    function allocateMarketingFunds(address to, uint256 amount) external;

    function setExcludedFromFeesAsRecipient(address account, bool whitelisted) external;

    function setExcludedFromFeesAsSender(address account, bool whitelisted) external;

    function setLiquidityThreshold(uint256 threshold) external;

    function setSwapRouter(address router) external;

    function setLiquidityTokenDestination(address destination) external;

    function claimDividends() external;

    function claimDividendsFor(uint256[] calldata tokenIds);

    function claimableDividends() external view returns (uint256 total);

    function claimableDividendsFor(uint256[] memory tokenIds) external view returns (uint256 total);
}
```
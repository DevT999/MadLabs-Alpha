import { useState, useEffect } from "react";
import { Container, Button } from "semantic-ui-react";

import React from 'react'

import './rising-sun-tracker.css';

import { formatNumber } from '../../utils/formatting'
import { ethers } from "ethers";

const { parseEther, parseUnits, formatEther } = require("ethers/lib/utils");

const RSUN_ADR = process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_RSUN_ADR_T : process.env.REACT_APP_RSUN_ADR_M;
const DIST_ADR = process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_DIST_ADR_T : process.env.REACT_APP_DIST_ADR_M;
const SWAP_ADR = process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_SWAP_ADR_T : process.env.REACT_APP_SWAP_ADR_M;
const COUPON_ADR = process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_COUPON_ADR_T : process.env.REACT_APP_COUPON_ADR_M;
const BUSD_ADR = process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_BUSD_ADR_T : process.env.REACT_APP_BUSD_ADR_M;
const S_REF_ADR = process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_SAMURAI_REFLECT_ADR_T : process.env.REACT_APP_SAMURAI_REFLECT_ADR_M;

console.debug(RSUN_ADR)
console.debug(DIST_ADR)

const bscProvider = new ethers.providers.JsonRpcProvider(process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_RPC_TEST : process.env.REACT_APP_RPC_MAIN)

const tokenAbi = [
    'function getTotalFee(bool selling) public view returns (uint256)',
]

const distAbi = [
    'function claimDividend() external',
    'function getUnpaidEarnings(address shareholder) public view returns (uint256)',
    'function totalDistributed() public view returns (uint256)',
    'function shares(address acc) public view returns (tuple(uint256 amount, uint256 totalExcluded, uint256 totalRealised))',
]

const swapAbi = [
    'function swappedBUSD(address adr) external view returns (uint)',
    'function swapBUSDForRsunWithoutFees(uint busdAmt) external',
    'function swapBNBForRsunWithoutFees(uint nftId) external payable',
]

const couponAbi = [
    'function balanceOf(address user) external view returns (uint)',
    'function claimCoupons() external',
    'function tokenOfOwnerByIndex(address owner, uint index) external view returns (uint)',
    'function setApprovalForAll(address operator, bool _approved) external',
    'function isApprovedForAll(address owner, address operator) external view returns (bool)',
    'function couponsClaimable(address adr) external view returns (uint)',
]

const busdAbi = [
    'function approve(address spender, uint amount) external',
    'function allowance(address owner, address spender) external view returns (uint)',
]

const sReflectAbi = [
    'function claimAllRewards() external',
    'function getAllUnrealizedRewards(address user) public view returns (uint)',
    'function getRealizedRewards(address user) public view returns (uint)',
    'function totalReflected() public view returns (uint)',
]

const token = new ethers.Contract(RSUN_ADR, tokenAbi, bscProvider);
const distributor = new ethers.Contract(DIST_ADR, distAbi, bscProvider);
const swap = new ethers.Contract(SWAP_ADR, swapAbi, bscProvider);
const coupon = new ethers.Contract(COUPON_ADR, couponAbi, bscProvider);
const busd = new ethers.Contract(BUSD_ADR, busdAbi, bscProvider);
const sReflect = new ethers.Contract(S_REF_ADR, sReflectAbi, bscProvider);

let web3Provider = Object.keys(window).includes('ethereum') ? new ethers.providers.Web3Provider(window.ethereum, "any") : Object.keys(window).includes('web3') ? new ethers.providers.Web3Provider(window.web3, "any") : undefined;
let signer;
let distSigner;
let user

let claimableCoupons, yourCoupons, freelySwappableBUSD, bnbAmountToSwap, busdAmountToSwap, totalBUSD = 0, couponsApproved, busdApproved, bnbInfo, busdInfo, swappingText = 'SWAPPING...', inSwapBUSD, inSwapBNB, sRefTotal, sRefRealized, sRefUnrealized, srefEarnings

const setLocalStorage = (key, value) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value)); // JSON.stringify(value)
    } catch (e) {
        console.error(e);
        // catch possible errors:
        // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
    }
}

const getLocalStorage = (key, initialValue) => {
    try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : initialValue;
    } catch (e) {
        // if error, return initial value
        return initialValue;
    }
}


const RisingSunTracker = () => {

    // useEffect(() => {
    //     let timer = setInterval(() => {
    //         fetchFee();
    //     }, 1000);

    //     return () => {
    //         if (timer) {
    //             clearInterval(timer);
    //         }
    //     }
    // })

    useEffect(() => {
        let timer = setInterval(() => {
            fetchDividends();
            fetchFreeSwapData();
            // fetchSReflectData();
            checkApprovals();
        }, 5000);

        return () => {
            if (timer) {
                clearInterval(timer);
            }
        }
    }, [])

    // const [user, setUser] = useState('');
    const [connected, setConnected] = useState(false);
    // const [fee, setFee] = useState(0);
    const [busdEarnings, setBusdEarnings] = useState(0);
    const [claimableBUSD, setClaimableBUSD] = useState(0);
    // const [share, setShare] = useState(undefined);
    // const [inFetchFee, setInFetchFee] = useState(false);
    const [inFetchDividends, setInFetchDividends] = useState(false);
    const [inFetchFreeSwapData, setInFetchFreeSwapData] = useState(false);
    // const [inFetchSReflectData, setInFetchSReflectData] = useState(false);
    const [inCheckApprovals, setInCheckApprovals] = useState(false);
    // const [notifsAllowed, setNotifsAllowed] = useState(() => getLocalStorage('notifsAllowed', false));

    const connect = async () => {
        web3Provider = Object.keys(window).includes('ethereum') ? new ethers.providers.Web3Provider(window.ethereum, "any") : Object.keys(window).includes('web3') ? new ethers.providers.Web3Provider(window.web3, "any") : undefined;

        // Prompt user for account connections
        if (web3Provider && !signer) {
            await web3Provider.send("eth_requestAccounts", []);
            signer = web3Provider.getSigner();
            distSigner = distributor.connect(signer)

            const adr = await signer.getAddress();
            user = adr;
            setConnected(true)
            console.log("Account:", adr);

            fetchDividends()
            fetchFreeSwapData()
            checkApprovals()
        }
    }

    const disconnect = () => {
        signer = undefined;
        user = ''
        setConnected(false)
        setClaimableBUSD(0);
        setBusdEarnings(0);
        claimableCoupons = 0;
        yourCoupons = 0;
        freelySwappableBUSD = 0;
        couponsApproved = false;
        busdApproved = false;
        srefEarnings = 0;
    }

    // const fetchFee = async () => {
    //     if (inFetchFee) return
    //     setInFetchFee(true)

    //     const oldFee = fee;
    //     let newFee = await token.getTotalFee(true);

    //     // if (Math.random() < 0.2) { // debug
    //     //     newFee = 2400;
    //     // }

    //     setFee(newFee);
    //     document.title = formatNumber(newFee / 100, 1) + "% RisingSun Tracker";

    //     if (oldFee != 0 && oldFee < 2350 && newFee > 2360) {
    //         notifySubscribers();
    //     }

    //     setInFetchFee(false)
    // }

    const fetchDividends = async () => {
        console.debug('entering fetchDividends')
        if (inFetchDividends) return

        setInFetchDividends(true)

        let totalBUSD_ = formatEther((await distributor.totalDistributed().catch(e => console.error(e))).toString())

        console.debug(`fetchDividends: totalBUSD_ : ${totalBUSD_}`)

        totalBUSD = totalBUSD_

        console.debug(`fetchDividends: user: ${user}`)
        if (user) {
            let unpaidEarnings = await distributor.getUnpaidEarnings(user).catch(e => console.error(e))

            if (!user) return

            let share_ = await distributor.shares(user).catch(e => console.error(e))

            setClaimableBUSD(formatEther(unpaidEarnings.toString()));

            console.debug(`fetchDividends: share_:`)
            console.debug(share_)

            if (share_ && Array.isArray(share_) && share_.length === 3) {
                const earnings = (share_[2].add(unpaidEarnings));
                setBusdEarnings(formatEther(earnings).toString());

                const swappedBUSD = await swap.swappedBUSD(user).catch(e => console.error(e))
                console.debug(`earnings = ${earnings}`)
                freelySwappableBUSD = earnings && swappedBUSD ? formatEther((earnings.sub(swappedBUSD)).toString()).toString() : '0'

                const busdAppr = await busd.allowance(user, SWAP_ADR).catch(e => console.error(e))

                busdApproved = (busdAppr - parseEther(freelySwappableBUSD.toString())) > '0'

                console.debug(`fetchDividends: busdApproved set to ${busdApproved}, with an allowance of ${busdAppr}`)
            }
        }

        setInFetchDividends(false)
    }

    const fetchFreeSwapData = async () => {
        console.debug('entering fetchFreeSwapData')
        if (inFetchFreeSwapData) return
        setInFetchFreeSwapData(true)

        if (user) {
            console.debug('fetchFreeSwapData if passed')

            claimableCoupons = await coupon.couponsClaimable(user).catch(e => console.error(e))
            yourCoupons = await coupon.balanceOf(user).catch(e => console.error(e))
        }

        setInFetchFreeSwapData(false)
    }

    // const fetchSReflectData = async () => {
    //     console.debug('entering fetchSReflectData')
    //     if (inFetchSReflectData) return
    //     setInFetchSReflectData(true)
        
    //     sRefTotal = formatEther((await sReflect.totalReflected().catch(e => console.error(e)))).toString()

    //     if (user) {
    //         console.debug('fetchSReflectData if passed')

    //         const realized = await sReflect.getRealizedRewards(user).catch(e => console.error(e))
    //         const unrealized = await sReflect.getAllUnrealizedRewards(user).catch(e => console.error(e))
            
    //         if (unrealized) {
    //             sRefUnrealized = formatEther(unrealized.toString()).toString()

    //             if (realized) {
    //                 srefEarnings = formatEther(realized.add(unrealized).toString()).toString()
    //             }
    //         }

    //     }

    //     setInFetchSReflectData(false)
    // }

    const checkApprovals = async () => {
        console.debug('entering checkApprovals')
        if (inCheckApprovals) return
        setInCheckApprovals(true)

        if (user) {
            console.debug('checkApprovals if passed')

            couponsApproved = await coupon.isApprovedForAll(user, SWAP_ADR).catch(e => console.error(e))

            console.debug(`checkApprovals: couponsApproved set to ${couponsApproved}`)

        }

        setInCheckApprovals(false)
    }

    // const enableNotifs = async () => {
    //     if (!Notification) {
    //         alert('Desktop notifications not available in your browser. Try Firefox or Chromium.');
    //         return;
    //     }

    //     if (Notification.permission !== 'granted' || !notifsAllowed) {
    //         Notification.requestPermission();
    //         setNotifsAllowed(true);
    //         setLocalStorage('notifsAllowed', true);
    //     }
    // }

    // const disableNotifs = async () => {
    //     if (!Notification) {
    //         alert('Desktop notifications not available in your browser. Try Firefox or Chromium.');
    //         return;
    //     }

    //     setNotifsAllowed(false);
    //     setLocalStorage('notifsAllowed', false);
    // }

    // const notifySubscribers = () => {
    //     if (Notification.permission !== 'granted' || !notifsAllowed)
    //         return;
    //     else {
    //         let notification = new Notification(`Dip slashed!`, { // Bought back with ${formatNumber(amount, 2)} BNB
    //             icon: samurai,
    //             body: 'The samurai have slashed the dip with a buyback. The fees are set to 24% again.',
    //         });
    //         notification.onclick = function () {
    //             // window.open('https://rising-sun-tracker.one/');
    //         };
    //     }
    // }

    const claimBUSD = async () => {
        if (distSigner) {
            await distSigner.claimDividend().catch(e => console.error(e))

            console.debug("claimed rsun dividend")
        }
    }

    const claimSRef = async () => {
        if (signer) {
            const sRefSigner = sReflect.connect(signer);

            const estimate = await sRefSigner.estimateGas.claimAllRewards().catch(e => console.error(e))

            await sRefSigner.claimAllRewards({ gasLimit: parseInt(estimate.toString()) + 200000 }).catch(e => console.error(e))

            console.debug("claimed samurai reflections")
        }
    }

    const claimCoupons = async () => {
        if (coupon && signer) {
            const couponSigner = coupon.connect(signer)
            await couponSigner.claimCoupons()
                .catch(e => {
                    console.log("claimCoupons failed with:")
                    console.log(e)
                })
        }
    }

    const onBNBSwapInput = e => {
        bnbAmountToSwap = e.target.value;
    }

    const onBUSDSwapInput = e => {
        busdAmountToSwap = e.target.value;
    }

    const approveCoupon = async () => {
        console.debug(`approveCoupon entered`)
        if (user && signer) {
            console.debug(`approveCoupon if passed`)

            const couponSigner = coupon.connect(signer)
            await couponSigner.setApprovalForAll(SWAP_ADR, true).catch(e => console.error(e))
        }
    }

    const swapBNB = async () => {
        console.debug(`swapBNB entered`)
        if (user && signer && bnbAmountToSwap > 0) {
            console.debug(`swapBNB if passed`)
            const c = await coupon.tokenOfOwnerByIndex(user, 0).catch(e => console.error(e))

            console.debug(`swapping using coupon with id ${c}...`)

            inSwapBNB = true

            const swapSigner = swap.connect(signer)
            await swapSigner.swapBNBForRsunWithoutFees(c, { value: parseEther(bnbAmountToSwap.toString()) })
                .then(v => {
                    bnbInfo = ''
                    inSwapBNB = false
                })
                .catch(e => {
                    console.error(`swap using coupon with id ${c} failed`)
                    console.error(e)

                    bnbInfo = 'Error. '
                    inSwapBNB = false
                })
        }
    }

    const approveBUSD = async () => {
        console.debug(`approveCoupon entered`)
        if (user && signer && freelySwappableBUSD) {
            console.debug(`approveCoupon if passed`)

            const busdSigner = busd.connect(signer)
            await busdSigner.approve(SWAP_ADR, parseEther((freelySwappableBUSD * 1.1).toString()))
                .catch((e) => {
                    console.debug("approve failed with error:");
                    console.debug(e);
                })
        }
    }

    const swapBUSD = async () => {
        console.debug(`swapBUSD entered`)
        if (user && signer && busdAmountToSwap > 0) {
            console.debug(`swapBUSD if passed`)

            inSwapBUSD = true

            const swapAmt = parseEther(busdAmountToSwap.toString())
            const swapSigner = swap.connect(signer)
            const estimate = await swapSigner.estimateGas.swapBUSDForRsunWithoutFees(swapAmt).catch(e => console.error(e))
            // console.log(`swapBUSDForRsunWithoutFees gasEstimate: ${estimate}`)

            if (!estimate) {
                inSwapBUSD = false
                return
            }

            await swapSigner.swapBUSDForRsunWithoutFees(swapAmt, { gasLimit: parseInt(estimate.toString()) + 400000 })
                .then(v => {
                    inSwapBUSD = false
                })
                .catch(e => {
                    console.error(`swap with ${busdAmountToSwap} failed`)
                    console.error(e)
                    inSwapBUSD = false
                })
        }
    }

    return (
        <Container>
            <video autoPlay muted loop playsInline className="bgVideo">
                <source src="./video.mp4" type="video/mp4" />
            </video>
            <div className="rsun-tracker-container">
                <img className="logoImage" src="./logo.jpg" alt="logo" />
                <Button type="button" className={"rsun-tracker-button wallet-button connect-button" + (connected ? " hidden" : "")} onClick={connect}>Connect</Button>
                <Button type="button" className={"rsun-tracker-button wallet-button connect-button" + (!connected ? " hidden" : "")} onClick={disconnect}>Disconnect</Button>
                {/* <span className="wallet-button-text">(Metamask and Trustwallet only)</span> */}

                <div className="title-section">
                    <h1>Madlads Tracker</h1>
                </div>

                <div className="rsun-tracker-reflect rsun-tracker-section">
                    <div className="stats-box">
                        <h3>Total BUSD Reflected (Madlad)</h3>
                        <p><span>{sRefTotal ? formatNumber(totalBUSD, 2) : '-'}</span> BUSD</p>
                    </div>
                    <div className="stats-box">
                        <h3>Your Earnings (Madlad)</h3>
                        <p>{busdEarnings ? (Math.floor(parseFloat(busdEarnings) * 100) / 100).toFixed(2) : '-'} BUSD</p>
                    </div>
                </div>

                <Button type="button" disabled={!connected} className={"rsun-tracker-button claim-button"} onClick={claimBUSD}>Claim {claimableBUSD ? formatNumber(claimableBUSD, 4) : '-'} BUSD</Button>

                <div className="rsun-tracker-reflect rsun-tracker-section">
                    <div className="stats-box">
                        <h3>Total BUSD Reflected (NFT)</h3>
                        <p><span>{sRefTotal ? formatNumber(sRefTotal, 2) : '-'}</span> BUSD</p>
                    </div>
                    <div className="stats-box">
                        <h3>Your Earnings (NFT)</h3>
                        <p>{srefEarnings ? (Math.floor(parseFloat(srefEarnings) * 100) / 100).toFixed(2) : '-'} BUSD</p>
                    </div>
                </div>

                <Button type="button" disabled={!connected} className={"rsun-tracker-button claim-button"} >Claim {sRefUnrealized ? formatNumber(sRefUnrealized, 4) : '-'} BUSD</Button>
{/* 
                <div className="rsun-tracker-swap-stats rsun-tracker-section">
                    <div className="stats-box">
                        <h3>Claimed Coupons</h3>
                        <div className="swap-div">
                            <div id="your-coupons"><p>{yourCoupons ? formatNumber(yourCoupons, 0) : '-'} Coupons</p></div>
                            <Button type="button" disabled={!connected || (claimableCoupons && claimableCoupons.toString() == '0')} className={"rsun-tracker-button claim-button"} onClick={claimCoupons}>Claim {claimableCoupons ? formatNumber(claimableCoupons, 0) : '-'} Coupons</Button>
                        </div>
                    </div>
                    <div className="stats-box">
                        <h3>Feelessly Swappable BUSD</h3>
                        <p>{freelySwappableBUSD ? (Math.floor(parseFloat(freelySwappableBUSD) * 100) / 100).toFixed(2) : '-'} BUSD</p>
                    </div>
                </div> */}



                {/* <div className="rsun-tracker-swap rsun-tracker-section">
                    <div className="stats-box">
                        <h3>Feeless Swap With Coupon</h3>
                        <div className="swap-div">
                            <div className="input-div"><input disabled={!connected || !yourCoupons} onInput={onBNBSwapInput} type='number' defaultValue='0' id='bnb-swap-input' className='swap-input' step="0.01"></input> <div>BNB</div> </div>
                            <div>
                                <Button type="button" disabled={!connected || !yourCoupons} className={"rsun-tracker-button swap-bnb-button" + (couponsApproved ? ' hidden' : '')} onClick={approveCoupon}>APPROVE</Button>
                                <Button type="button" disabled={!connected || !yourCoupons || formatNumber(yourCoupons, 0) < 1 || !bnbAmountToSwap || 10 - bnbAmountToSwap < 0 || inSwapBNB} className={"rsun-tracker-button swap-bnb-button" + (!couponsApproved ? ' hidden' : '')} onClick={swapBNB}>{inSwapBNB ? swappingText : `SWAP (MAX. 10 BNB) [SINGLE USE]`}</Button>
                                {/* <span className="info-text">{bnbInfo}</span>
                            </div>
                        </div>
                    </div>
                    <div className="stats-box">
                        <h3>Feeless BUSD Reinvesting</h3>
                        <div className="swap-div busd-swap-div">
                            <div className="input-div"><input disabled={!connected || !freelySwappableBUSD} onInput={onBUSDSwapInput} type='number' defaultValue='0' id='busd-swap-input' className='swap-input'></input> <div>BUSD</div> </div>
                            <div>
                                <Button type="button" disabled={!connected || !freelySwappableBUSD} className={"rsun-tracker-button swap-bnb-button" + (busdApproved ? ' hidden' : '')} onClick={approveBUSD}>APPROVE</Button>
                                <Button type="button" disabled={!connected || !freelySwappableBUSD || !busdAmountToSwap || freelySwappableBUSD - busdAmountToSwap < 0 || inSwapBUSD} className={"rsun-tracker-button swap-bnb-button" + (!busdApproved ? ' hidden' : '')} onClick={swapBUSD}>{inSwapBUSD ? swappingText : `SWAP [NO COUPON REQUIRED]`}</Button>
                                <p>{busdInfo}</p>
                            </div>
                        </div>
                    </div>
                </div> */}

                

            </div>
        </Container>
    );
}

export default RisingSunTracker
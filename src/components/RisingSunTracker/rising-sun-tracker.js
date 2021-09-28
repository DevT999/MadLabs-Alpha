import { useState } from "react";
import { Container, Button, Input, Label } from "semantic-ui-react";

import React from 'react'

import './rising-sun-tracker.css';

import { ethers } from "ethers";

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import madladABI from '../../abi/MadCredits.json';

const RSUN_ADR = process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_RSUN_ADR_T : process.env.REACT_APP_RSUN_ADR_M;

const bscProvider = new ethers.providers.JsonRpcProvider(process.env.REACT_APP_TESTNET != 'false' ? process.env.REACT_APP_RPC_TEST : process.env.REACT_APP_RPC_MAIN)

const madlads = new ethers.Contract(RSUN_ADR, madladABI, bscProvider);

let web3Provider = Object.keys(window).includes('ethereum') ? new ethers.providers.Web3Provider(window.ethereum, "any") : Object.keys(window).includes('web3') ? new ethers.providers.Web3Provider(window.web3, "any") : undefined;
let signer;

let claimableCoupons, yourCoupons, freelySwappableBUSD, couponsApproved, busdApproved, sRefUnrealized, srefEarnings

const RisingSunTracker = () => {

    const [user, setUser] = useState('');
    const [connected, setConnected] = useState(false);

    // added newly
    const [claimableDividends, setClaimableDividends] = useState(0);
    const [totalDividendsAccumulated, setTotalDividendsAccumulated] = useState("0");
    const [tokenString, setTokenString] = useState("");

    const balanceMsg = (msg) => toast(msg);

    const connect = async () => {
        web3Provider = Object.keys(window).includes('ethereum') ? new ethers.providers.Web3Provider(window.ethereum, "any") : Object.keys(window).includes('web3') ? new ethers.providers.Web3Provider(window.web3, "any") : undefined;

        // Prompt user for account connections
        if (web3Provider && !signer) {
            // await web3Provider.send("eth_requestAccounts", []);
            signer = web3Provider.getSigner();
            const chainId = await signer.getChainId();
            if((process.env.REACT_APP_TESTNET === 'false' && chainId === 56) || (process.env.REACT_APP_TESTNET === 'true' && chainId === 97)) {
                await madlads.totalDividendsAccumulated().then(res => setTotalDividendsAccumulated((res.div(ethers.BigNumber.from(1e15))).toNumber()/1000.0));
                const bal = await signer.getBalance();
                if(bal.eq(0)) {
                    balanceMsg("Your wallet balance is 0!");
                    signer = undefined;
                    return;
                }
                const adr = await signer.getAddress();
                setUser(adr);
                await madlads.claimableDividends(adr).then(res => setClaimableDividends(res.toString()));
                setConnected(true)
            }
            else {
                signer = undefined;
                balanceMsg("Wrong Network!");
            }
        }
    }

    const disconnect = () => {
        signer = undefined;
        setUser('');
        setConnected(false)
        claimableCoupons = 0;
        yourCoupons = 0;
        freelySwappableBUSD = 0;
        couponsApproved = false;
        busdApproved = false;
        srefEarnings = 0;


        setClaimableDividends(0);
        setTotalDividendsAccumulated("0");
    }

    const claimDividends = async () => {
        if (signer) {
            const madlads_write = writableContract();
            madlads_write.claimDividends(user).then(res => console.log(res)).catch(e => console.error(e))
        }
        else alert("Please connect your wallet");
    } 

    const claimDividendsFor = async () => {
        
        if (signer) {
            const tokenArr = tokenString.split(" ").filter(ele => ele !=="");
            if(!tokenArr.length) {
                balanceMsg('Please input token ids!'); 
                return;
            }
            const madlads_write = writableContract();
            try {
                await madlads_write
                    .claimDividendsFor(tokenArr, user)
                    .then((res) => console.log(res));
            } catch (e) {
                const errorMsg = e.data.message;
                if(errorMsg.includes("nonexist")) balanceMsg("There is nonexisting ID!");
                else balanceMsg("There is an ID that doesn't belong to you!")
            }
            // madlads_write.claimDividendsFor(tokenArr, user).then(res => console.log(res)).catch(e => console.error(e))
        }
        else alert("Please connect your wallet");
    } 

    const writableContract = () => {
        return new ethers.Contract(RSUN_ADR, madladABI, signer);
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
                        <h3>Claimable Dividends</h3>
                        <p><span>{claimableDividends}</span></p>
                    </div>
                    <div className="stats-box">
                        <h3>Total Dividends Accumulated</h3>
                        <p>{totalDividendsAccumulated}</p>
                    </div>
                </div>

                <Button type="button" disabled={!connected} className={"rsun-tracker-button claim-button button-top"} onClick={claimDividends}>Claim - Dividends</Button>
{/* 
                <div className="rsun-tracker-reflect rsun-tracker-section">
                    <div className="stats-box">
                        <h3>Total BUSD Reflected (NFT)</h3>
                        <p><span>{sRefTotal ? formatNumber(sRefTotal, 2) : '-'}</span></p>
                    </div>
                    <div className="stats-box">
                        <h3>Your Earnings (NFT)</h3>
                        <p>{srefEarnings ? (Math.floor(parseFloat(srefEarnings) * 100) / 100).toFixed(2) : '-'}</p>
                    </div>
                </div> */}
                <div className="rsun-tracker-reflect rsun-tracker-section margin-top-0 padding-top-0">
                    <div className="stats-box min-height-unset margin-top-0">
                        <div className="ui inverted input input-wrapper margin-top-0">
                            <input 
                                placeholder="Type Token Ids..." 
                                type="text" 
                                onKeyPress={(event) => 
                                    {
                                        if (!/[0-9 ]/.test(event.key)) 
                                            {event.preventDefault();}
                                    }
                                }
                                onChange={event => setTokenString(event.target.value)}
                            />
                        </div>
                        <div className="input-label"><span>*Use space as separator</span></div>
                    </div>
                </div>
                <Button type="button" disabled={!connected} className={"rsun-tracker-button claim-button"} onClick={claimDividendsFor}>Claim Dividends For</Button>
            </div>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              // pauseOnHover
            />
        </Container>
    );
}

export default RisingSunTracker
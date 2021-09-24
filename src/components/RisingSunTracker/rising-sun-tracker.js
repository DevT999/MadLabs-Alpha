import { useState } from "react";
import { Container, Button } from "semantic-ui-react";

import React from 'react'

import './rising-sun-tracker.css';

import { formatNumber } from '../../utils/formatting'
import { ethers } from "ethers";
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
    const [arr, setIdArr] = useState([100, 101]);

    const connect = async () => {
        web3Provider = Object.keys(window).includes('ethereum') ? new ethers.providers.Web3Provider(window.ethereum, "any") : Object.keys(window).includes('web3') ? new ethers.providers.Web3Provider(window.web3, "any") : undefined;

        // Prompt user for account connections
        if (web3Provider && !signer) {
            await web3Provider.send("eth_requestAccounts", []);
            signer = web3Provider.getSigner();
            const adr = await signer.getAddress();
            setUser(adr);
            await madlads.claimableDividends(adr).then(res => setClaimableDividends(res.toNumber()));
            await madlads.totalDividendsAccumulated().then(res => setTotalDividendsAccumulated(res.toString()));
            setConnected(true)
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
            const madlads_write = writableContract();
            madlads_write.claimDividendsFor(arr, RSUN_ADR).then(res => console.log(res)).catch(e => console.error(e))
        }
        else alert("Please connect your wallet");
    } 

    const writableContract = () => {
        return new ethers.Contract(RSUN_ADR, madladABI, signer);
    }
    
    const truncate = (input, length) => input.length > length ? `${input.substring(0, length)}...` : input;

    const getButtonText = () => {
        if (signer) {
            return `${truncate(user,6,)}`;
        }
        return `CONNECT`;
    };

    return (
        <Container>
            <video autoPlay muted loop playsInline className="bgVideo">
                <source src="./video.mp4" type="video/mp4" />
            </video>
            <div className="rsun-tracker-container">
                <img className="logoImage" src="./logo.jpg" alt="logo" />
                <Button type="button" className={"rsun-tracker-button wallet-button connect-button" + (connected ? " hidden" : "")} onClick={connect}>Connect</Button>
                <Button type="button" className={"rsun-tracker-button wallet-button connect-button" + (!connected ? " hidden" : "")} onClick={disconnect}>{getButtonText()}</Button>
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

                <Button type="button" disabled={!connected} className={"rsun-tracker-button claim-button"} onClick={claimDividendsFor}>Claim Dividends For</Button>

            </div>
        </Container>
    );
}

export default RisingSunTracker
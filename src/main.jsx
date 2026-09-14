import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const TREASURY =
  "0xf6F80827cBAf83798c7763FCd915C0068F2bE60C";

const CHAIN_ID = "0x1237";

const missions = [
  {
    id: "x-follow",
    title: "Follow VeyroHood on X",
    description: "Follow the official VeyroHood account.",
    link: "https://x.com/VeyroHood",
    button: "Follow on X",
  },
  {
    id: "discord",
    title: "Join the Discord",
    description: "Join the official VeyroHood community.",
    link: "https://discord.gg/utFuXHYHp",
    button: "Join Discord",
  },
  {
    id: "quote",
    title: "Quote the Pinned Post",
    description: "Quote the official VeyroHood pinned post.",
    link: "https://x.com/VeyroHood/status/2095434542094115048",
    button: "Quote Post",
  },
  {
    id: "reply",
    title: "Reply to the Pinned Post",
    description: "Reply to the official VeyroHood pinned post.",
    link: "https://x.com/VeyroHood/status/2095434542094115048",
    button: "Reply",
  },
];

function shortenAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function App() {
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [verification, setVerification] = useState({
    xUsername: "",
    discordUsername: "",
    quoteLink: "",
    replyLink: "",
  });

  const [stats] = useState({
    joined: 0,
    ogRemaining: 1000,
    totalSupply: 10000,
  });

  const [referrals] = useState(0);
  const [earnings] = useState(0);

  useEffect(() => {
    const savedWallet = localStorage.getItem("veyrohood_wallet");

    if (savedWallet) {
      setWallet(savedWallet);
    }
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus(
        "No EVM wallet detected. Please install Robinhood Wallet or MetaMask."
      );
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || !accounts.length) return;

      const address = accounts[0];

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_ID }],
        });
      } catch (error) {
        if (error.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: CHAIN_ID,
                chainName: "Robinhood Chain",
                nativeCurrency: {
                  name: "Ether",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: [
                  "https://rpc.mainnet.chain.robinhood.com",
                ],
                blockExplorerUrls: [
                  "https://robinhoodchain.blockscout.com",
                ],
              },
            ],
          });
        }
      }

      setWallet(address);
      localStorage.setItem("veyrohood_wallet", address);
      setStatus("Wallet connected successfully.");
    } catch (error) {
      console.error(error);
      setStatus("Wallet connection was cancelled.");
    }
  }

  function disconnectWallet() {
    setWallet("");
    localStorage.removeItem("veyrohood_wallet");
    setStatus("Wallet disconnected.");
  }

  function handleMission(mission) {
    window.open(
      mission.link,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handleInput(event) {
    const { name, value } = event.target;

    setVerification((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function submitVerification(event) {
    event.preventDefault();

    if (!wallet) {
      setStatus("Please connect your wallet first.");
      return;
    }

    const fields = Object.values(verification);

    if (fields.some((value) => !value.trim())) {
      setStatus("Please complete all verification fields.");
      return;
    }

    setStatus(
      "Verification submitted. Backend verification will be connected next."
    );
  }

  async function copyReferral() {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }

    const referralLink =
      `${window.location.origin}/?ref=${wallet}`;

    try {
      await navigator.clipboard.writeText(referralLink);
      setStatus("Referral link copied.");
    } catch {
      setStatus(referralLink);
    }
  }

  function withdraw() {
    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }

    setStatus(
      "Withdrawals will activate after the referral smart contract is connected."
    );
  }

  return (
    <div className="app">

      <header className="navbar">
        <div className="container nav-inner">

          <a href="#home" className="logo">
            VEYRO<span>HOOD</span>
          </a>

          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            ☰
          </button>

          <nav className={mobileMenu ? "nav-links open" : "nav-links"}>
            <a href="#missions">Missions</a>
            <a href="#referrals">Referrals</a>
            <a href="#allocation">NFT Allocation</a>
            <a href="#faq">FAQ</a>
          </nav>

          {wallet ? (
            <button
              className="wallet-button connected"
              onClick={disconnectWallet}
            >
              {shortenAddress(wallet)}
            </button>
          ) : (
            <button
              className="wallet-button"
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          )}

        </div>
      </header>

      <main>

        <section id="home" className="hero">

          <div className="hero-glow glow-one"></div>
          <div className="hero-glow glow-two"></div>

          <div className="container hero-grid">

            <div className="hero-copy">

              <div className="eyebrow">
                ROBINHOOD CHAIN · NFT COMMUNITY
              </div>

              <h1>
                ENTER THE
                <br />
                <span>VEYROHOOD.</span>
              </h1>

              <p>
                Complete the missions, verify your participation,
                earn OG status and secure your place in the
                VeyroHood NFT ecosystem.
              </p>

              <div className="hero-actions">

                <a
                  href="#missions"
                  className="primary-button"
                >
                  Start Missions
                </a>

                {!wallet && (
                  <button
                    className="secondary-button"
                    onClick={connectWallet}
                  >
                    Connect Wallet
                  </button>
                )}

              </div>

              <div className="hero-note">
                First 1,000 eligible wallets receive guaranteed
                OG allocation.
              </div>

            </div>

            <div className="character-wrap">

              <div className="character-ring"></div>

              <div className="floating-card card-one">
                <strong>1,000</strong>
                <span>OG Allocation</span>
              </div>

              <img
                src="/veyrohood-character.jpg"
                alt="VeyroHood character"
                className="character"
              />

              <div className="floating-card card-two">
                <strong>10,000</strong>
                <span>Total NFTs</span>
              </div>

            </div>

          </div>
        </section>

        <section className="stats-section">

          <div className="container stats-grid">

            <div className="stat">
              <strong>
                {stats.joined.toLocaleString()}
              </strong>
              <span>Joined</span>
            </div>

            <div className="stat">
              <strong>
                {stats.ogRemaining.toLocaleString()}
              </strong>
              <span>OG Spots Remaining</span>
            </div>

            <div className="stat">
              <strong>
                {stats.totalSupply.toLocaleString()}
              </strong>
              <span>NFT Supply</span>
            </div>

            <div className="stat">
              <strong>$0.25</strong>
              <span>Verification Value</span>
            </div>

          </div>

        </section>

        <section id="missions" className="section">

          <div className="container">

            <div className="section-heading">

              <div>
                <div className="eyebrow">
                  01 · MISSIONS
                </div>

                <h2>
                  Complete the missions.
                </h2>
              </div>

              <p>
                Complete every mission before submitting
                your verification.
              </p>

            </div>

            <div className="mission-grid">

              {missions.map((mission, index) => (

                <div
                  className="mission-card"
                  key={mission.id}
                >

                  <div className="mission-number">
                    0{index + 1}
                  </div>

                  <h3>
                    {mission.title}
                  </h3>

                  <p>
                    {mission.description}
                  </p>

                  <button
                    className="mission-button"
                    onClick={() => handleMission(mission)}
                  >
                    {mission.button}
                    <span>↗</span>
                  </button>

                </div>

              ))}

            </div>

            <div className="verification-panel">

              <div>

                <div className="eyebrow">
                  VERIFICATION
                </div>

                <h3>
                  Submit your mission proof.
                </h3>

                <p>
                  Connect your wallet and provide your
                  account details and post links.
                </p>

              </div>

              <form
                className="verification-form"
                onSubmit={submitVerification}
              >

                <input
                  name="xUsername"
                  placeholder="X username"
                  value={verification.xUsername}
                  onChange={handleInput}
                />

                <input
                  name="discordUsername"
                  placeholder="Discord username"
                  value={verification.discordUsername}
                  onChange={handleInput}
                />

                <input
                  name="quoteLink"
                  placeholder="Quote post link"
                  value={verification.quoteLink}
                  onChange={handleInput}
                />

                <input
                  name="replyLink"
                  placeholder="Reply post link"
                  value={verification.replyLink}
                  onChange={handleInput}
                />

                <button
                  className="primary-button"
                  type="submit"
                >
                  Submit Verification
                </button>

              </form>

              <div className="fee-note">
                Verification fee: $0.25 worth of native ETH
                on Robinhood Chain.
              </div>

            </div>

          </div>

        </section>

        <section
          id="referrals"
          className="section dark-section"
        >

          <div className="container">

            <div className="section-heading">

              <div>

                <div className="eyebrow">
                  02 · REFERRALS
                </div>

                <h2>
                  Bring your hood.
                </h2>

              </div>

              <p>
                Earn 20% from each qualified referral who
                completes verification.
              </p>

            </div>

            <div className="referral-dashboard">

              <div className="referral-main">

                <span className="dashboard-label">
                  Your referral link
                </span>

                <div className="referral-link-box">
                  {wallet
                    ? `${window.location.origin}/?ref=${wallet}`
                    : "Connect wallet to generate your link"}
                </div>

                <button
                  className="primary-button"
                  onClick={copyReferral}
                >
                  Copy Referral Link
                </button>

              </div>

              <div className="referral-stats">

                <div>
                  <span>Referrals</span>
                  <strong>{referrals}</strong>
                </div>

                <div>
                  <span>Referral Earnings</span>
                  <strong>
                    ${earnings.toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Minimum Withdrawal</span>
                  <strong>$2.00</strong>
                </div>

                <button
                  className="withdraw-button"
                  onClick={withdraw}
                >
                  Withdraw
                </button>

              </div>

            </div>

            <div className="leaderboard">

              <div className="leaderboard-header">

                <div>
                  <div className="eyebrow">
                    LIVE LEADERBOARD
                  </div>

                  <h3>
                    Top Referrers
                  </h3>
                </div>

                <span className="live-indicator">
                  ● LIVE
                </span>

              </div>

              <div className="leader-row header">
                <span>Rank</span>
                <span>Wallet</span>
                <span>Referrals</span>
              </div>

              <div className="leader-row">
                <span>#1</span>
                <span>—</span>
                <strong>0</strong>
              </div>

              <div className="leader-row">
                <span>#2</span>
                <span>—</span>
                <strong>0</strong>
              </div>

              <div className="leader-row">
                <span>#3</span>
                <span>—</span>
                <strong>0</strong>
              </div>

            </div>

          </div>

        </section>

        <section id="allocation" className="section">

          <div className="container allocation">

            <div className="allocation-copy">

              <div className="eyebrow">
                03 · NFT ALLOCATION
              </div>

              <h2>
                10,000 NFTs.
                <br />
                One community.
              </h2>

              <p>
                The first 1,000 eligible wallets receive
                guaranteed OG allocation. The remaining
                9,000 NFTs are reserved for eligible
                verified participants through the FCFS pool.
              </p>

              <div className="allocation-list">

                <div>
                  <strong>1,000</strong>
                  <span>
                    OG guaranteed allocation
                  </span>
                </div>

                <div>
                  <strong>9,000</strong>
                  <span>
                    Remaining FCFS allocation pool
                  </span>
                </div>

                <div>
                  <strong>10,000</strong>
                  <span>
                    Total NFT supply
                  </span>
                </div>

              </div>

            </div>

            <div className="allocation-visual">

              <div className="orbit orbit-one"></div>
              <div className="orbit orbit-two"></div>

              <div className="allocation-center">
                <span>VEYRO</span>
                <strong>10K</strong>
                <span>HOOD</span>
              </div>

            </div>

          </div>

        </section>

        <section id="faq" className="section faq-section">

          <div className="container">

            <div className="section-heading">

              <div>
                <div className="eyebrow">
                  04 · FAQ
                </div>

                <h2>
                  Know the rules.
                </h2>
              </div>

            </div>

            <div className="faq-grid">

              <div className="faq-card">
                <h3>
                  What is the verification fee?
                </h3>

                <p>
                  The verification fee is designed to equal
                  $0.25 worth of native ETH on Robinhood Chain.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  How does referrals work?
                </h3>

                <p>
                  Referrers receive 20% of the verification
                  value from qualified referrals.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  When can I withdraw?
                </h3>

                <p>
                  Withdrawals become available once the
                  referral balance reaches $2.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  What is OG?
                </h3>

                <p>
                  OG is the guaranteed NFT allocation for
                  the first 1,000 eligible wallets.
                </p>
              </div>

            </div>

          </div>

        </section>

      </main>

      <footer>

        <div className="container footer-inner">

          <div>
            <strong>VEYROHOOD</strong>
            <p>Built for the hood.</p>
          </div>

          <div className="footer-links">

            <a
              href="https://x.com/VeyroHood"
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>

            <a
              href="https://discord.gg/utFuXHYHp"
              target="_blank"
              rel="noreferrer"
            >
              Discord
            </a>

            <a
              href={`https://robinhoodchain.blockscout.com/address/${TREASURY}`}
              target="_blank"
              rel="noreferrer"
            >
              Treasury
            </a>

          </div>

        </div>

      </footer>

      {status && (
        <div className="toast">
          {status}

          <button
            onClick={() => setStatus("")}
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}

createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

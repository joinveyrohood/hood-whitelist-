import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const CHAIN_ID = "0x1237";

const CHAIN_CONFIG = {
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
};

const TREASURY_ADDRESS =
  "0xf6F80827cBAf83798c7763FCd915C0068F2bE60C";

const OG_LIMIT = 1000;
const NFT_SUPPLY = 10000;
const VERIFICATION_USD = 0.25;
const REFERRAL_PERCENT = 20;
const WITHDRAWAL_USD = 2;

const X_URL = "https://x.com/VeyroHood";
const DISCORD_URL = "https://discord.gg/utFuXHYHp";
const PINNED_POST =
  "https://x.com/VeyroHood/status/2095434542094115048";

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getReferralWallet() {
  try {
    const params = new URLSearchParams(
      window.location.search
    );

    const ref = params.get("ref");

    if (!ref) return "";

    return ref.toLowerCase();
  } catch {
    return "";
  }
}

function App() {
  const [wallet, setWallet] = useState("");
  const [user, setUser] = useState(null);

  const [stats, setStats] = useState({
    joined: 0,
    og: 0,
  });

  const [referralCount, setReferralCount] = useState(0);
  const [referralEarnings, setReferralEarnings] = useState(0);

  const [xUsername, setXUsername] = useState("");
  const [discordUsername, setDiscordUsername] =
    useState("");

  const [quoteLink, setQuoteLink] = useState("");
  const [replyLink, setReplyLink] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(
    "Connect your wallet to join VeyroHood."
  );

  const [verificationStatus, setVerificationStatus] =
    useState("pending");

  const [leaderboard, setLeaderboard] = useState([]);

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const referralWallet = getReferralWallet();

  async function switchToRobinhood() {
    if (!window.ethereum) {
      throw new Error(
        "Please install an EVM-compatible wallet."
      );
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID }],
      });
    } catch (error) {
      if (error.code !== 4902) {
        throw error;
      }

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [CHAIN_CONFIG],
      });
    }
  }

  async function saveUser(address) {
    try {
      const normalizedWallet =
        address.toLowerCase();

      const existing = await supabase
        .from("users")
        .select("*")
        .eq(
          "wallet_address",
          normalizedWallet
        )
        .maybeSingle();

      if (existing.error) {
        console.error(existing.error);
      }

      if (existing.data) {
        const data = existing.data;

        setUser(data);
        setReferralCount(
          Number(data.referral_count || 0)
        );
        setReferralEarnings(
          Number(data.referral_earnings || 0)
        );
        setXUsername(data.x_username || "");
        setDiscordUsername(
          data.discord_username || ""
        );
        setVerificationStatus(
          data.verification_status || "pending"
        );

        return data;
      }

      const referrer =
        referralWallet &&
        referralWallet !== normalizedWallet
          ? referralWallet
          : null;

      const inserted = await supabase
        .from("users")
        .insert({
          wallet_address: normalizedWallet,
          referrer_wallet: referrer,
          is_og: false,
          referral_count: 0,
          referral_earnings: 0,
          verification_status: "pending",
        });

      if (inserted.error) {
        console.error(inserted.error);

        setStatus(
          "Wallet connected, but user registration failed."
        );

        return null;
      }

      setReferralCount(0);
      setReferralEarnings(0);
      setVerificationStatus("pending");

      await loadUserData(normalizedWallet);

      return true;
    } catch (error) {
      console.error(error);

      setStatus(
        "Could not save wallet information."
      );

      return null;
    }
  }

  async function connectWallet() {
    try {
      setLoading(true);
      setStatus("Connecting wallet...");

      if (!window.ethereum) {
        setStatus(
          "Please install an EVM-compatible wallet."
        );
        return;
      }

      await switchToRobinhood();

      const accounts =
        await window.ethereum.request({
          method: "eth_requestAccounts",
        });

      if (!accounts || accounts.length === 0) {
        setStatus("No wallet account found.");
        return;
      }

      const address =
        accounts[0].toLowerCase();

      setWallet(address);

      localStorage.setItem(
        "veyrohood_wallet",
        address
      );

      await saveUser(address);

      setStatus(
        "Wallet connected successfully."
      );

      await loadStats();
      await loadLeaderboard();
    } catch (error) {
      console.error(error);

      setStatus(
        error?.message ||
          "Wallet connection failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const result = await supabase
        .from("users")
        .select("is_og", {
          count: "exact",
          head: false,
        });

      if (result.error) {
        console.error(result.error);
        return;
      }

      const joined = result.count || 0;

      const ogResult = await supabase
        .from("users")
        .select("is_og", {
          count: "exact",
          head: false,
        })
        .eq("is_og", true);

      const og =
        ogResult.count || 0;

      setStats({
        joined,
        og,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function loadLeaderboard() {
    try {
      const result = await supabase
        .from("users")
        .select(
          "wallet_address, referral_count, referral_earnings"
        )
        .order("referral_count", {
          ascending: false,
        })
        .limit(10);

      if (result.error) {
        console.error(result.error);
        return;
      }

      setLeaderboard(result.data || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadUserData(address) {
    if (!address) return;

    try {
      const result = await supabase
        .from("users")
        .select("*")
        .eq(
          "wallet_address",
          address.toLowerCase()
        )
        .maybeSingle();

      if (result.error) {
        console.error(result.error);
        return;
      }

      if (!result.data) return;

      const data = result.data;

      setUser(data);

      setReferralCount(
        Number(data.referral_count || 0)
      );

      setReferralEarnings(
        Number(data.referral_earnings || 0)
      );

      setXUsername(data.x_username || "");

      setDiscordUsername(
        data.discord_username || ""
      );

      setVerificationStatus(
        data.verification_status || "pending"
      );
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadStats();
    loadLeaderboard();

    const savedWallet =
      localStorage.getItem(
        "veyrohood_wallet"
      );

    if (savedWallet) {
      const normalized =
        savedWallet.toLowerCase();

      setWallet(normalized);
      loadUserData(normalized);
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    function handleAccountsChanged(accounts) {
      if (!accounts || accounts.length === 0) {
        setWallet("");
        setUser(null);
        localStorage.removeItem(
          "veyrohood_wallet"
        );
        setStatus(
          "Wallet disconnected."
        );
        return;
      }

      const address =
        accounts[0].toLowerCase();

      setWallet(address);

      localStorage.setItem(
        "veyrohood_wallet",
        address
      );

      loadUserData(address);
    }

    window.ethereum.on(
      "accountsChanged",
      handleAccountsChanged
    );

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
      }
    };
  }, []);

  async function submitVerification() {
    if (!wallet) {
      setStatus(
        "Connect your wallet first."
      );
      return;
    }

    if (!xUsername.trim()) {
      setStatus(
        "Enter your X username."
      );
      return;
    }

    if (!discordUsername.trim()) {
      setStatus(
        "Enter your Discord username."
      );
      return;
    }

    if (!quoteLink.trim()) {
      setStatus(
        "Enter your Quote Post link."
      );
      return;
    }

    if (!replyLink.trim()) {
      setStatus(
        "Enter your Reply Post link."
      );
      return;
    }

    try {
      setLoading(true);
      setStatus(
        "Submitting verification..."
      );

      const verification =
        await supabase
          .from("verifications")
          .insert({
            wallet_address:
              wallet.toLowerCase(),
            x_follow: true,
            discord_join: true,
            quote_link:
              quoteLink.trim(),
            reply_link:
              replyLink.trim(),
            is_verified: false,
          });

      if (verification.error) {
        console.error(
          verification.error
        );

        setStatus(
          "Verification submission failed."
        );

        return;
      }

      const update =
        await supabase
          .from("users")
          .update({
            x_username:
              xUsername.trim(),
            discord_username:
              discordUsername.trim(),
            verification_status:
              "submitted",
          })
          .eq(
            "wallet_address",
            wallet.toLowerCase()
          );

      if (update.error) {
        console.error(update.error);
      }

      setVerificationStatus(
        "submitted"
      );

      setStatus(
        "Verification submitted successfully."
      );

      await loadStats();
      await loadLeaderboard();
    } catch (error) {
      console.error(error);

      setStatus(
        "Could not submit verification."
      );
    } finally {
      setLoading(false);
    }
  }

  function copyReferralLink() {
    if (!wallet) {
      setStatus(
        "Connect your wallet first."
      );
      return;
    }

    const link =
      `${window.location.origin}/?ref=${wallet}`;

    if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      navigator.clipboard
        .writeText(link)
        .then(() => {
          setStatus(
            "Referral link copied."
          );
        })
        .catch(() => {
          setStatus(
            "Could not copy referral link."
          );
        });
    } else {
      setStatus(
        "Copy is not supported on this browser."
      );
    }
  }

  function withdraw() {
    if (!wallet) {
      setStatus(
        "Connect your wallet first."
      );
      return;
    }

    if (
      referralEarnings <
      WITHDRAWAL_USD
    ) {
      setStatus(
        "Minimum withdrawal is $2."
      );
      return;
    }

    setStatus(
      "Withdrawal contract is not connected yet."
    );
  }

  function handleMission(type) {
    if (type === "x") {
      window.open(
        X_URL,
        "_blank",
        "noopener,noreferrer"
      );
    }

    if (type === "discord") {
      window.open(
        DISCORD_URL,
        "_blank",
        "noopener,noreferrer"
      );
    }

    if (
      type === "quote" ||
      type === "reply"
    ) {
      window.open(
        PINNED_POST,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }

  const ogRemaining =
    Math.max(
      OG_LIMIT - stats.og,
      0
    );

  const nftRemaining =
    Math.max(
      NFT_SUPPLY - stats.og,
      0
    );

  return (
    <div className="app">

      <nav className="navbar">
        <div className="container nav-inner">

          <a
            className="logo"
            href="#top"
          >
            VEYRO<span>HOOD</span>
          </a>

          <div
            className={`nav-links ${
              mobileMenuOpen
                ? "open"
                : ""
            }`}
          >
            <a href="#missions">
              Missions
            </a>

            <a href="#verification">
              Verification
            </a>

            <a href="#referrals">
              Referrals
            </a>

            <a href="#nft">
              NFT
            </a>
          </div>

          <button
            className="wallet-button"
            onClick={connectWallet}
            disabled={loading}
          >
            {wallet
              ? shortAddress(wallet)
              : "Connect Wallet"}
          </button>

          <button
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen(
                !mobileMenuOpen
              )
            }
            aria-label="Menu"
          >
            ☰
          </button>

        </div>
      </nav>

      <header
        className="hero"
        id="top"
      >

        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />

        <div className="container hero-grid">

          <div className="hero-copy">

            <div className="eyebrow">
              WEB3 • NFT • COMMUNITY
            </div>

            <h1>
              Veyro
              <br />
              <span>Hood.</span>
            </h1>

            <p>
              Join the VeyroHood whitelist,
              complete the missions,
              become one of the first
              1,000 OG members and secure
              your guaranteed NFT allocation.
            </p>

            <div className="hero-actions">

              <button
                className="primary-button"
                onClick={connectWallet}
                disabled={loading}
              >
                {wallet
                  ? shortAddress(wallet)
                  : "Connect Wallet"}
              </button>

              <a
                className="secondary-button"
                href="#missions"
              >
                View Missions
              </a>

            </div>

            <div className="hero-note">
              {status}
            </div>

          </div>

          <div className="character-wrap">

            <div className="character-ring" />

            <img
              className="character"
              src="/veyrohood-character.jpg"
              alt="VeyroHood character"
            />

            <div className="floating-card card-one">
              <strong>
                {ogRemaining}
              </strong>
              <span>
                OG SPOTS LEFT
              </span>
            </div>

            <div className="floating-card card-two">
              <strong>
                {NFT_SUPPLY}
              </strong>
              <span>
                TOTAL NFT SUPPLY
              </span>
            </div>

          </div>

        </div>
      </header>

      <section className="stats-section">
        <div className="container stats-grid">

          <div className="stat">
            <strong>
              {stats.joined}
            </strong>
            <span>
              Members Joined
            </span>
          </div>

          <div className="stat">
            <strong>
              {stats.og}
              {" / "}
              {OG_LIMIT}
            </strong>
            <span>
              OG Members
            </span>
          </div>

          <div className="stat">
            <strong>
              {ogRemaining}
            </strong>
            <span>
              OG Spots Remaining
            </span>
          </div>

          <div className="stat">
            <strong>
              {NFT_SUPPLY.toLocaleString()}
            </strong>
            <span>
              NFT Supply
            </span>
          </div>

        </div>
      </section>

      <main>

        <section
          className="section"
          id="missions"
        >

          <div className="container">

            <div className="section-heading">

              <h2>
                Complete
                <br />
                The Missions.
              </h2>

              <p>
                Complete all four missions
                before submitting your
                verification information.
              </p>

            </div>

            <div className="mission-grid">

              <div className="mission-card">

                <span className="mission-number">
                  01
                </span>

                <h3>
                  Follow VeyroHood
                </h3>

                <p>
                  Follow the official
                  VeyroHood account on X.
                </p>

                <button
                  className="mission-button"
                  onClick={() =>
                    handleMission("x")
                  }
                >
                  <span>
                    Open X
                  </span>
                  <span>
                    →
                  </span>
                </button>

              </div>

              <div className="mission-card">

                <span className="mission-number">
                  02
                </span>

                <h3>
                  Join Discord
                </h3>

                <p>
                  Join the official
                  VeyroHood Discord community.
                </p>

                <button
                  className="mission-button"
                  onClick={() =>
                    handleMission(
                      "discord"
                    )
                  }
                >
                  <span>
                    Open Discord
                  </span>
                  <span>
                    →
                  </span>
                </button>

              </div>

              <div className="mission-card">

                <span className="mission-number">
                  03
                </span>

                <h3>
                  Quote The Post
                </h3>

                <p>
                  Quote the official
                  pinned VeyroHood post.
                </p>

                <button
                  className="mission-button"
                  onClick={() =>
                    handleMission(
                      "quote"
                    )
                  }
                >
                  <span>
                    Open Post
                  </span>
                  <span>
                    →
                  </span>
                </button>

              </div>

              <div className="mission-card">

                <span className="mission-number">
                  04
                </span>

                <h3>
                  Reply To The Post
                </h3>

                <p>
                  Reply to the official
                  pinned VeyroHood post.
                </p>

                <button
                  className="mission-button"
                  onClick={() =>
                    handleMission(
                      "reply"
                    )
                  }
                >
                  <span>
                    Open Post
                  </span>
                  <span>
                    →
                  </span>
                </button>

              </div>

            </div>

          </div>

        </section>

        <section
          className="section dark-section"
          id="verification"
        >

          <div className="container">

            <div className="section-heading">

              <h2>
                Verify
                <br />
                Your Entry.
              </h2>

              <p>
                Submit your X username,
                Discord username, quote link
                and reply link for review.
              </p>

            </div>

            <div className="verification-panel">

              <div>

                <h3>
                  Verification
                </h3>

                <p>
                  Your information will be
                  linked to your connected
                  wallet.
                </p>

                <p>
                  Current status:
                  <br />
                  <strong>
                    {verificationStatus}
                  </strong>
                </p>

              </div>

              <div className="verification-form">

                <input
                  type="text"
                  placeholder="X username"
                  value={xUsername}
                  onChange={(e) =>
                    setXUsername(
                      e.target.value
                    )
                  }
                />

                <input
                  type="text"
                  placeholder="Discord username"
                  value={
                    discordUsername
                  }
                  onChange={(e) =>
                    setDiscordUsername(
                      e.target.value
                    )
                  }
                />

                <input
                  type="url"
                  placeholder="Quote post link"
                  value={quoteLink}
                  onChange={(e) =>
                    setQuoteLink(
                      e.target.value
                    )
                  }
                />

                <input
                  type="url"
                  placeholder="Reply post link"
                  value={replyLink}
                  onChange={(e) =>
                    setReplyLink(
                      e.target.value
                    )
                  }
                />

                <button
                  className="primary-button"
                  onClick={
                    submitVerification
                  }
                  disabled={loading}
                >
                  {loading
                    ? "Submitting..."
                    : "Submit Verification"}
                </button>

                <div className="fee-note">
                  Verification fee:
                  {" "}
                  ${VERIFICATION_USD}
                  {" "}
                  worth of native ETH
                  on Robinhood Chain.
                </div>

              </div>

            </div>

          </div>

        </section>

        <section
          className="section"
          id="referrals"
        >

          <div className="container">

            <div className="section-heading">

              <h2>
                Build Your
                <br />
                Hood.
              </h2>

              <p>
                Invite eligible members through
                your referral link and earn
                {` ${REFERRAL_PERCENT}% `}
                of qualified verification
                payments.
              </p>

            </div>

            <div className="referral-dashboard">

              <div className="referral-main">

                <span className="dashboard-label">
                  YOUR REFERRAL LINK
                </span>

                <div className="referral-link-box">
                  {wallet
                    ? `${window.location.origin}/?ref=${wallet}`
                    : "Connect wallet to generate your referral link."}
                </div>

                <button
                  className="primary-button"
                  onClick={
                    copyReferralLink
                  }
                >
                  Copy Referral Link
                </button>

              </div>

              <div className="referral-stats">

                <div>
                  <span>
                    Referrals
                  </span>
                  <strong>
                    {referralCount}
                  </strong>
                </div>

                <div>
                  <span>
                    Earnings
                  </span>
                  <strong>
                    $
                    {referralEarnings.toFixed(
                      2
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Withdrawal
                  </span>
                  <strong>
                    ${WITHDRAWAL_USD} min
                  </strong>
                </div>

                <button
                  className="withdraw-button"
                  onClick={withdraw}
                >
                  Withdraw Earnings
                </button>

              </div>

            </div>

            <div className="leaderboard">

              <div className="leaderboard-header">

                <h3>
                  Referral Leaderboard
                </h3>

                <span className="live-indicator">
                  ● LIVE
                </span>

              </div>

              <div className="leader-row header">
                <span>
                  Rank
                </span>

                <span>
                  Wallet
                </span>

                <span>
                  Referrals
                </span>
              </div>

              {leaderboard.length === 0 ? (
                <div className="leader-row">
                  <span>
                    —
                  </span>

                  <span>
                    No referral data yet.
                  </span>

                  <span>
                    0
                  </span>
                </div>
              ) : (
                leaderboard.map(
                  (item, index) => (
                    <div
                      className="leader-row"
                      key={
                        item.wallet_address
                      }
                    >
                      <span>
                        #{index + 1}
                      </span>

                      <strong>
                        {shortAddress(
                          item.wallet_address
                        )}
                      </strong>

                      <span>
                        {item.referral_count ||
                          0}
                      </span>
                    </div>
                  )
                )
              )}

            </div>

          </div>

        </section>

        <section
          className="section dark-section"
          id="nft"
        >

          <div className="container">

            <div className="allocation">

              <div className="allocation-copy">

                <h2>
                  10,000
                  <br />
                  NFTs.
                </h2>

                <p>
                  VeyroHood NFT allocation is
                  designed around the OG community
                  first, followed by the remaining
                  eligible whitelist members.
                </p>

                <div className="allocation-list">

                  <div>
                    <strong>
                      1,000
                    </strong>

                    <span>
                      OG GUARANTEED
                    </span>
                  </div>

                  <div>
                    <strong>
                      9,000
                    </strong>

                    <span>
                      ELIGIBLE FCFS
                    </span>
                  </div>

                  <div>
                    <strong>
                      {nftRemaining.toLocaleString()}
                    </strong>

                    <span>
                      ESTIMATED REMAINING
                    </span>
                  </div>

                </div>

              </div>

              <div className="allocation-visual">

                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />

                <div className="allocation-center">

                  <span>
                    SUPPLY
                  </span>

                  <strong>
                    10K
                  </strong>

                  <span>
                    NFTS
                  </span>

                </div>

              </div>

            </div>

          </div>

        </section>

        <section className="section">

          <div className="container">

            <div className="section-heading">

              <h2>
                Why
                <br />
                VeyroHood?
              </h2>

              <p>
                Early community members get
                priority access and a guaranteed
                OG NFT allocation.
              </p>

            </div>

            <div className="faq-grid">

              <div className="faq-card">

                <h3>
                  What makes an OG?
                </h3>

                <p>
                  The first 1,000 eligible
                  members who complete the
                  required entry process are
                  designated as OG members.
                </p>

              </div>

              <div className="faq-card">

                <h3>
                  How many NFTs are there?
                </h3>

                <p>
                  The total VeyroHood NFT
                  supply is 10,000.
                </p>

              </div>

              <div className="faq-card">

                <h3>
                  What happens after the
                  first 1,000?
                </h3>

                <p>
                  The remaining 9,000 NFT
                  allocation is reserved for
                  eligible submitted wallets
                  on a first-come,
                  first-served basis.
                </p>

              </div>

              <div className="faq-card">

                <h3>
                  What is the referral reward?
                </h3>

                <p>
                  Qualified referrals receive
                  a 20% referral allocation from
                  the verification payment.
                  Withdrawal begins at $2.
                </p>

              </div>

            </div>

          </div>

        </section>

        <section className="section">

          <div className="container">

            <div className="verification-panel">

              <div>

                <h3>
                  Verification Fee
                </h3>

                <p>
                  ${VERIFICATION_USD}
                  {" "}
                  worth of native ETH on
                  Robinhood Chain.
                </p>

              </div>

              <div>

                <p>
                  80% is allocated to the
                  VeyroHood treasury.
                </p>

                <p>
                  20% is allocated to the
                  eligible referrer.
                </p>

                <p>
                  Treasury:
                  {" "}
                  {shortAddress(
                    TREASURY_ADDRESS
                  )}
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>

      <footer>

        <div className="container footer-inner">

          <div>

            <strong>
              VeyroHood
            </strong>

            <p>
              Web3 community • NFT •
              Whitelist
            </p>

          </div>

          <div className="footer-links">

            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>

            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
            >
              Discord
            </a>

            <a
              href="https://robinhoodchain.blockscout.com"
              target="_blank"
              rel="noreferrer"
            >
              Explorer
            </a>

          </div>

        </div>

      </footer>

      {status && (
        <div className="toast">
          <span>
            {status}
          </span>

          <button
            onClick={() =>
              setStatus("")
            }
            aria-label="Close"
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

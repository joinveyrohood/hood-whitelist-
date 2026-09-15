import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const ROBINHOOD_CHAIN_ID = "0x1237";
const ROBINHOOD_CHAIN_HEX = "0x1237";

const TREASURY_ADDRESS =
  "0xf6F80827cBAf83798c7763FCd915C0068F2bE60C";

const OG_LIMIT = 1000;
const NFT_SUPPLY = 10000;
const VERIFICATION_USD = 0.25;
const REFERRAL_PERCENT = 20;
const WITHDRAWAL_USD = 2;

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getReferralWallet() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    if (!ref) return null;

    if (/^0x[a-fA-F0-9]{40}$/.test(ref)) {
      return ref.toLowerCase();
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeAddress(address) {
  return address ? address.toLowerCase() : "";
}

async function getEthPriceUsd() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );

    if (!response.ok) {
      throw new Error("Could not get ETH price.");
    }

    const data = await response.json();
    const price = Number(data?.ethereum?.usd);

    if (!price || price <= 0) {
      throw new Error("Invalid ETH price.");
    }

    return price;
  } catch {
    return null;
  }
}

function usdToWei(usd, ethPrice) {
  if (!ethPrice || ethPrice <= 0) return null;

  const ethAmount = usd / ethPrice;

  const wei = BigInt(
    Math.ceil(ethAmount * 1e18)
  );

  return "0x" + wei.toString(16);
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
  const [discordUsername, setDiscordUsername] = useState("");
  const [quoteLink, setQuoteLink] = useState("");
  const [replyLink, setReplyLink] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [verificationStatus, setVerificationStatus] =
    useState("pending");

  const [leaderboard, setLeaderboard] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [paymentTx, setPaymentTx] = useState("");

  const referralWallet = getReferralWallet();

  const isVerified =
    verificationStatus === "verified" ||
    user?.verification_status === "verified";

  const referralLink =
    wallet && isVerified
      ? `${window.location.origin}/?ref=${wallet}`
      : "";

  async function switchToRobinhood() {
    if (!window.ethereum) {
      setStatus("Please install an EVM wallet such as MetaMask.");
      return false;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: ROBINHOOD_CHAIN_HEX,
          },
        ],
      });

      return true;
    } catch (switchError) {
      if (switchError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ROBINHOOD_CHAIN_HEX,
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

          return true;
        } catch {
          setStatus("Could not add Robinhood Chain.");
          return false;
        }
      }

      setStatus("Please switch your wallet to Robinhood Chain.");
      return false;
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Please install an EVM wallet first.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || !accounts.length) {
        throw new Error("No wallet account found.");
      }

      const address = normalizeAddress(accounts[0]);

      const chainChanged = await switchToRobinhood();

      if (!chainChanged) {
        setLoading(false);
        return;
      }

      setWallet(address);

      await saveUser(address);
      await loadUserData(address);
      await loadStats();
      await loadLeaderboard();

      setStatus("Wallet connected successfully.");
    } catch (error) {
      console.error(error);
      setStatus(
        error?.message || "Wallet connection failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveUser(address) {
    if (!supabase || !address) return;

    const existingReferrer = referralWallet;

    const payload = {
      wallet_address: address,
    };

    if (
      existingReferrer &&
      normalizeAddress(existingReferrer) !== normalizeAddress(address)
    ) {
      payload.referrer_wallet = existingReferrer;
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(payload, {
        onConflict: "wallet_address",
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error("saveUser:", error);
      return null;
    }

    if (data) {
      setUser(data);
      setVerificationStatus(
        data.verification_status || "pending"
      );
    }

    return data;
  }

  async function loadUserData(address) {
    if (!supabase || !address) return;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", normalizeAddress(address))
      .maybeSingle();

    if (error) {
      console.error("loadUserData:", error);
      return;
    }

    if (!data) return;

    setUser(data);
    setReferralCount(Number(data.referral_count || 0));
    setReferralEarnings(
      Number(data.referral_earnings || 0)
    );

    setVerificationStatus(
      data.verification_status || "pending"
    );

    setXUsername(data.x_username || "");
    setDiscordUsername(data.discord_username || "");
  }

  async function loadStats() {
    if (!supabase) return;

    const { count: joinedCount } = await supabase
      .from("users")
      .select("*", {
        count: "exact",
        head: true,
      });

    const { count: ogCount } = await supabase
      .from("users")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("is_og", true);

    setStats({
      joined: joinedCount || 0,
      og: Math.min(ogCount || 0, OG_LIMIT),
    });
  }

  async function loadLeaderboard() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("users")
      .select(
        "wallet_address, referral_count, referral_earnings"
      )
      .order("referral_count", {
        ascending: false,
      })
      .limit(10);

    if (error) {
      console.error("loadLeaderboard:", error);
      return;
    }

    setLeaderboard(data || []);
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (!accounts || !accounts.length) {
        setWallet("");
        setUser(null);
        setVerificationStatus("pending");
        setReferralCount(0);
        setReferralEarnings(0);
        return;
      }

      const address = normalizeAddress(accounts[0]);

      setWallet(address);
      await loadUserData(address);
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on(
      "accountsChanged",
      handleAccountsChanged
    );

    window.ethereum.on(
      "chainChanged",
      handleChainChanged
    );

    return () => {
      window.ethereum.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );

      window.ethereum.removeListener(
        "chainChanged",
        handleChainChanged
      );
    };
  }, []);

  useEffect(() => {
    loadStats();
    loadLeaderboard();
  }, []);

  async function payVerificationFee() {
    if (!window.ethereum) {
      setStatus("Please connect an EVM wallet first.");
      return null;
    }

    const chainChanged = await switchToRobinhood();

    if (!chainChanged) return null;

    setStatus("Getting current ETH price...");

    const ethPrice = await getEthPriceUsd();

    if (!ethPrice) {
      setStatus(
        "Could not get the current ETH/USD price. Please try again."
      );
      return null;
    }

    const value = usdToWei(
      VERIFICATION_USD,
      ethPrice
    );

    if (!value) {
      setStatus("Could not calculate the ETH payment.");
      return null;
    }

    setStatus("Please confirm the $0.25 ETH payment in your wallet.");

    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: wallet,
          to: TREASURY_ADDRESS,
          value,
        },
      ],
    });

    return txHash;
  }

  async function waitForTransaction(txHash) {
    if (!window.ethereum || !txHash) return false;

    for (let i = 0; i < 30; i++) {
      try {
        const receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });

        if (receipt) {
          return receipt.status === "0x1";
        }
      } catch (error) {
        console.error(error);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 3000)
      );
    }

    return false;
  }

  async function submitVerification(event) {
    event.preventDefault();

    if (!wallet) {
      setStatus("Connect your wallet first.");
      return;
    }

    if (!xUsername.trim()) {
      setStatus("Enter your X username.");
      return;
    }

    if (!discordUsername.trim()) {
      setStatus("Enter your Discord username.");
      return;
    }

    if (!quoteLink.trim()) {
      setStatus("Enter your Quote post link.");
      return;
    }

    if (!replyLink.trim()) {
      setStatus("Enter your Reply link.");
      return;
    }

    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    setLoading(true);
    setStatus("Preparing verification payment...");

    try {
      await saveUser(wallet);

      const txHash = await payVerificationFee();

      if (!txHash) {
        setLoading(false);
        return;
      }

      setPaymentTx(txHash);

      setStatus(
        "Payment sent. Waiting for blockchain confirmation..."
      );

      const confirmed = await waitForTransaction(txHash);

      if (!confirmed) {
        setStatus(
          "Payment was not confirmed. Please try again."
        );
        setLoading(false);
        return;
      }

      setStatus(
        "Payment confirmed. Saving your verification..."
      );

      const { error: verificationError } = await supabase
        .from("verifications")
        .insert({
          wallet_address: normalizeAddress(wallet),
          x_follow: true,
          discord_join: true,
          quote_link: quoteLink.trim(),
          reply_link: replyLink.trim(),
          is_verified: true,
          verified_at: new Date().toISOString(),
        });

      if (verificationError) {
        console.error(
          "verification insert:",
          verificationError
        );
      }

      const { data: updatedUser, error: updateError } =
        await supabase
          .from("users")
          .update({
            x_username: xUsername.trim(),
            discord_username: discordUsername.trim(),
            verification_status: "verified",
          })
          .eq(
            "wallet_address",
            normalizeAddress(wallet)
          )
          .select()
          .maybeSingle();

      if (updateError) {
        console.error(
          "user verification update:",
          updateError
        );
      }

      if (updatedUser) {
        setUser(updatedUser);
      }

      setVerificationStatus("verified");

      await loadUserData(wallet);
      await loadStats();
      await loadLeaderboard();

      setStatus(
        "Verification successful! Your referral link is now unlocked."
      );
    } catch (error) {
      console.error(error);

      setStatus(
        error?.message ||
          "Verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyReferralLink() {
    if (!isVerified || !referralLink) {
      setStatus(
        "Complete verification and payment first."
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        referralLink
      );

      setStatus("Referral link copied.");
    } catch {
      setStatus("Could not copy the referral link.");
    }
  }

  async function withdraw() {
    if (!isVerified) {
      setStatus(
        "Referral withdrawals unlock after verification."
      );
      return;
    }

    if (referralEarnings < WITHDRAWAL_USD) {
      setStatus(
        `Withdrawal unlocks at $${WITHDRAWAL_USD}.`
      );
      return;
    }

    setStatus(
      "Referral withdrawal will be handled by the referral smart contract."
    );
  }

  function handleMission(type) {
    if (type === "x") {
      window.open(
        "https://x.com/VeyroHood",
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    if (type === "discord") {
      window.open(
        "https://discord.gg/utFuXHYHp",
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    if (type === "quote") {
      window.open(
        "https://x.com/VeyroHood/status/2095434542094115048",
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    if (type === "reply") {
      window.open(
        "https://x.com/VeyroHood/status/2095434542094115048",
        "_blank",
        "noopener,noreferrer"
      );
    }
  }

  return (
    <div className="app">

      {/* NAVBAR */}

      <nav className="navbar">
        <div className="container nav-inner">

          <a
            href="#top"
            className="logo"
          >
            VEYRO<span>HOOD</span>
          </a>

          <div
            className={`nav-links ${
              mobileMenuOpen ? "open" : ""
            }`}
          >
            <a
              href="#missions"
              onClick={() => setMobileMenuOpen(false)}
            >
              Missions
            </a>

            <a
              href="#verification"
              onClick={() => setMobileMenuOpen(false)}
            >
              Verify
            </a>

            <a
              href="#referrals"
              onClick={() => setMobileMenuOpen(false)}
            >
              Referrals
            </a>

            <a
              href="#allocation"
              onClick={() => setMobileMenuOpen(false)}
            >
              NFT
            </a>

            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </a>
          </div>

          <button
            className={`wallet-button ${
              wallet ? "connected" : ""
            }`}
            onClick={connectWallet}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : wallet
              ? shortAddress(wallet)
              : "Connect Wallet"}
          </button>

          <button
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen(!mobileMenuOpen)
            }
            aria-label="Open menu"
          >
            ☰
          </button>

        </div>
      </nav>

      {/* HERO */}

      <main id="top">

        <section className="hero">
          <div className="hero-glow glow-one" />
          <div className="hero-glow glow-two" />

          <div className="container hero-grid">

            <div className ="hero-copy">

              <div className="eyebrow">
                VeyroHood NFT Campaign
              </div>

              <h1>
                JOIN.
                <br />
                <span>VERIFY.</span>
                <br />
                EARN.
              </h1>

              <p>
                Complete the missions, verify your wallet,
                become one of the first 1,000 OG members,
                and unlock your VeyroHood referral link.
              </p>

              <div className="hero-actions">

                <button
                  className="primary-button"
                  onClick={connectWallet}
                >
                  {wallet
                    ? "Wallet Connected"
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
                Robinhood Chain • 10,000 NFT Supply •
                1,000 OG Spots
              </div>

              {status && (
                <div className="hero-note">
                  {status}
                </div>
              )}

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
                  {stats.og}/{OG_LIMIT}
                </strong>
                <span>OG Spots</span>
              </div>

              <div className="floating-card card-two">
                <strong>
                  {stats.joined}
                </strong>
                <span>Joined</span>
              </div>

            </div>

          </div>
        </section>

        {/* STATS */}

        <section className="stats-section">
          <div className="container stats-grid">

            <div className="stat">
              <strong>{stats.joined}</strong>
              <span>Joined Users</span>
            </div>

            <div className="stat">
              <strong>{stats.og}</strong>
              <span>OG Members</span>
            </div>

            <div className="stat">
              <strong>{NFT_SUPPLY.toLocaleString()}</strong>
              <span>Total NFTs</span>
            </div>

            <div className="stat">
              <strong>{VERIFICATION_USD}</strong>
              <span>Verification USD</span>
            </div>

          </div>
        </section>

        {/* MISSIONS */}

        <section
          className="section"
          id="missions"
        >
          <div className="container">

            <div className="section-heading">
              <h2>
                COMPLETE
                <br />
                MISSIONS.
              </h2>

              <p>
                Complete all four missions before submitting
                your verification. Your links are checked
                during the verification process.
              </p>
            </div>

            <div className="mission-grid">

              <div className="mission-card">
                <div className="mission-number">
                  01
                </div>

                <h3>Follow X</h3>

                <p>
                  Follow the official VeyroHood account on X.
                </p>

                <button
                  className="mission-button"
                  onClick={() => handleMission("x")}
                >
                  Follow
                  <span>↗</span>
                </button>
              </div>

              <div className="mission-card">
                <div className="mission-number">
                  02
                </div>

                <h3>Join Discord</h3>

                <p>
                  Join the official VeyroHood Discord community.
                </p>

                <button
                  className="mission-button"
                  onClick={() =>
                    handleMission("discord")
                  }
                >
                  Join
                  <span>↗</span>
                </button>
              </div>

              <div className="mission-card">
                <div className="mission-number">
                  03
                </div>

                <h3>Quote Post</h3>

                <p>
                  Quote the pinned VeyroHood campaign post
                  and submit the quote link.
                </p>

                <button
                  className="mission-button"
                  onClick={() =>
                    handleMission("quote")
                  }
                >
                  Quote
                  <span>↗</span>
                </button>
              </div>

              <div className="mission-card">
                <div className="mission-number">
                  04
                </div>

                <h3>Reply Post</h3>

                <p>
                  Reply to the pinned campaign post and
                  submit your reply link.
                </p>

                <button
                  className="mission-button"
                  onClick={() =>
                    handleMission("reply")
                  }
                >
                  Reply
                  <span>↗</span>
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* VERIFICATION */}

        <section
          className="section dark-section"
          id="verification"
        >
          <div className="container">

            <div className="section-heading">
              <h2>
                VERIFY
                <br />
                ACCESS.
              </h2>

              <p>
                Connect your wallet, complete the missions,
                provide your social details and pay the
                $0.25 native ETH verification fee.
              </p>
            </div>

            <div className="verification-panel">

              <div>
                <h3>
                  Verification
                </h3>

                <p>
                  Your referral program unlocks only after
                  the verification payment is confirmed
                  on Robinhood Chain.
                </p>

                {isVerified ? (
                  <p>
                    ✓ Verified. Referral access unlocked.
                  </p>
                ) : (
                  <p>
                    Status: Waiting for verification.
                  </p>
                )}

                {paymentTx && (
                  <p>
                    Payment: {shortAddress(paymentTx)}
                  </p>
                )}
              </div>

              <form
                className="verification-form"
                onSubmit={submitVerification}
              >

                <input
                  type="text"
                  placeholder="X username"
                  value={xUsername}
                  onChange={(e) =>
                    setXUsername(e.target.value)
                  }
                />

                <input
                  type="text"
                  placeholder="Discord username"
                  value={discordUsername}
                  onChange={(e) =>
                    setDiscordUsername(e.target.value)
                  }
                />

                <input
                  type="url"
                  placeholder="Quote post link"
                  value={quoteLink}
                  onChange={(e) =>
                    setQuoteLink(e.target.value)
                  }
                />

                <input
                  type="url"
                  placeholder="Reply post link"
                  value={replyLink}
                  onChange={(e) =>
                    setReplyLink(e.target.value)
                  }
                />

                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading || isVerified}
                >
                  {isVerified
                    ? "✓ VERIFIED"
                    : loading
                    ? "PROCESSING..."
                    : `VERIFY + PAY $${VERIFICATION_USD}`}
                </button>

                <div className="fee-note">
                  Payment is made in native ETH on
                  Robinhood Chain. The current ETH/USD
                  rate is used to calculate approximately
                  $0.25 worth of ETH.
                </div>

              </form>

            </div>
          </div>
        </section>

        {/* REFERRALS */}

        <section
          className="section"
          id="referrals"
        >
          <div className="container">

            <div className="section-heading">
              <h2>
                REFER.
                <br />
                EARN.
              </h2>

              <p>
                Verified members can invite new members
                and earn the referral share from qualified
                verification payments.
              </p>
            </div>

            {!isVerified ? (
              <div className="referral-dashboard">

                <div className="referral-main">

                  <div className="dashboard-label">
                    Referral Access
                  </div>

                  <div className="referral-link-box">
                    Complete verification and the $0.25
                    payment first. Your referral link will
                    appear here after verification.
                  </div>

                  <button
                    className="withdraw-button"
                    onClick={() =>
                      setStatus(
                        "Verify first to unlock referrals."
                      )
                    }
                  >
                    VERIFY TO UNLOCK
                  </button>

                </div>

                <div className="referral-stats">

                  <div>
                    <span>Referrals</span>
                    <strong>Locked</strong>
                  </div>

                  <div>
                    <span>Earnings</span>
                    <strong>Locked</strong>
                  </div>

                  <div>
                    <span>Withdraw</span>
                    <strong>Locked</strong>
                  </div>

                  <div>
                    <span>Share</span>
                    <strong>{REFERRAL_PERCENT}%</strong>
                  </div>

                </div>

              </div>
            ) : (
              <>
                <div className="referral-dashboard">

                  <div className="referral-main">

                    <div className="dashboard-label">
                      Your Referral Link
                    </div>

                    <div className="referral-link-box">
                      {referralLink}
                    </div>

                    <button
                      className="primary-button"
                      onClick={copyReferralLink}
                    >
                      COPY REFERRAL LINK
                    </button>

                  </div>

                  <div className="referral-stats">

                    <div>
                      <span>Referrals</span>
                      <strong>
                        {referralCount}
                      </strong>
                    </div>

                    <div>
                      <span>Earnings</span>
                      <strong>
                        ${referralEarnings.toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <span>Share</span>
                      <strong>
                        {REFERRAL_PERCENT}%
                      </strong>
                    </div>

                    <div>
                      <span>Withdraw</span>
                      <button
                        className="withdraw-button"
                        onClick={withdraw}
                      >
                        ${WITHDRAWAL_USD}+
                      </button>
                    </div>

                  </div>

                </div>

                <div className="leaderboard">

                  <div className="leaderboard-header">

                    <h3>
                      Referral Leaderboard
                    </h3>

                    <div className="live-indicator">
                      ● LIVE
                    </div>

                  </div>

                  <div className="leader-row header">
                    <span>Rank</span>
                    <span>Wallet</span>
                    <span>Referrals</span>
                  </div>

                  {leaderboard.length > 0 ? (
                    leaderboard.map((item, index) => (
                      <div
                        className="leader-row"
                        key={item.wallet_address}
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
                          {item.referral_count || 0}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="leader-row">
                      <span>—</span>
                      <span>
                        No referrals yet
                      </span>
                      <span>0</span>
                    </div>
                  )}

                </div>
              </>
            )}

          </div>
        </section>

        {/* NFT ALLOCATION */}

        <section
          className="section dark-section"
          id="allocation"
        >
          <div className="container allocation">

            <div className="allocation-copy">

              <h2>
                10,000
                <br />
                NFTS.
              </h2>

              <p>
                The first 1,000 eligible verified members
                become OG members and receive one guaranteed
                mint allocation. The remaining 9,000 NFTs
                are reserved for eligible verified wallets
                through the campaign allocation process.
              </p>

              <div className="allocation-list">

                <div>
                  <strong>1,000</strong>
                  <span>OG guaranteed</span>
                </div>

                <div>
                  <strong>9,000</strong>
                  <span>Remaining allocation</span>
                </div>

                <div>
                  <strong>10,000</strong>
                  <span>Total supply</span>
                </div>

              </div>

            </div>

            <div className="allocation-visual">

              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />

              <div className="allocation-center">
                <span>NFT</span>
                <strong>10K</strong>
                <span>SUPPLY</span>
              </div>

            </div>

          </div>
        </section>

        {/* FAQ */}

        <section
          className="section"
          id="faq"
        >
          <div className="container">

            <div className="section-heading">
              <h2>
                FAQ.
              </h2>

              <p>
                The essentials of the VeyroHood campaign.
              </p>
            </div>

            <div className="faq-grid">

              <div className="faq-card">
                <h3>
                  What is the verification fee?
                </h3>

                <p>
                  Verification requires $0.25 worth of
                  native ETH on Robinhood Chain.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  When do I receive my referral link?
                </h3>

                <p>
                  Only after your verification payment is
                  confirmed and your verification status
                  becomes verified.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  How many OG spots are there?
                </h3>

                <p>
                  There are 1,000 OG spots for eligible
                  verified campaign participants.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  How many NFTs are available?
                </h3>

                <p>
                  The total VeyroHood NFT supply is 10,000.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  How does the referral program work?
                </h3>

                <p>
                  A verified member receives the referral
                  share from qualified members who join
                  through their referral link.
                </p>
              </div>

              <div className="faq-card">
                <h3>
                  Which chain is used?
                </h3>

                <p>
                  VeyroHood uses Robinhood Chain mainnet,
                  an EVM-compatible network.
                </p>
              </div>

            </div>

          </div>
        </section>

      </main>

      {/* FOOTER */}

      <footer>
        <div className="container footer-inner">

          <div>
            <strong>VEYROHOOD</strong>

            <p>
              Web3 NFT campaign.
            </p>
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
              href="https://robinhoodchain.blockscout.com"
              target="_blank"
              rel="noreferrer"
            >
              Explorer
            </a>

          </div>

        </div>
      </footer>

      {/* TOAST */}

      {status && (
        <div className="toast">

          <span>
            {status}
          </span>

          <button
            onClick={() => setStatus("")}
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
  <App />
);

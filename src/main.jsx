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

      const address = accounts[0].toLowerCase();

      setWallet(address);

      localStorage.setItem(
        "veyrohood_wallet",
        address
      );

      await saveUser(address);

      setStatus("Wallet connected successfully.");
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
    async function saveUser(address) {
    try {
      const normalizedWallet =
        address.toLowerCase();

      const existing =
        await supabase
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
        setUser(existing.data);

        setReferralCount(
          existing.data.referral_count || 0
        );

        setReferralEarnings(
          Number(
            existing.data.referral_earnings || 0
          )
        );

        setXUsername(
          existing.data.x_username || ""
        );

        setDiscordUsername(
          existing.data.discord_username || ""
        );

        setVerificationStatus(
          existing.data.verification_status ||
            "pending"
        );

        return existing.data;
      }

      const referrer =
        referralWallet &&
        referralWallet !== normalizedWallet
          ? referralWallet
          : null;

      const inserted =
        await supabase
          .from("users")
          .insert({
            wallet_address:
              normalizedWallet,
            referrer_wallet: referrer,
            is_og: false,
            referral_count: 0,
            referral_earnings: 0,
            verification_status:
              "pending",
          })
          .select()
          .single();

      if (inserted.error) {
        console.error(inserted.error);

        setStatus(
          "Wallet connected, but user registration failed."
        );

        return null;
      }

      setUser(inserted.data);

      setReferralCount(0);
      setReferralEarnings(0);

      return inserted.data;
    } catch (error) {
      console.error(error);

      setStatus(
        "Could not save wallet information."
      );

      return null;
    }
  }

  async function loadStats() {
    try {
      const result =
        await supabase
          .from("users")
          .select(
            "is_og",
            { count: "exact" }
          );

      if (result.error) {
        console.error(result.error);
        return;
      }

      const joined =
        result.count || 0;

      const ogResult =
        await supabase
          .from("users")
          .select(
            "is_og",
            { count: "exact" }
          )
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
      const result =
        await supabase
          .from("users")
          .select(
            "wallet_address, referral_count, referral_earnings"
          )
          .order(
            "referral_count",
            {
              ascending: false,
            }
          )
          .limit(10);

      if (result.error) {
        console.error(result.error);
        return;
      }

      setLeaderboard(
        result.data || []
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function loadUserData(address) {
    if (!address) return;

    try {
      const result =
        await supabase
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

      setUser(result.data);

      setReferralCount(
        result.data.referral_count || 0
      );

      setReferralEarnings(
        Number(
          result.data.referral_earnings || 0
        )
      );

      setXUsername(
        result.data.x_username || ""
      );

      setDiscordUsername(
        result.data.discord_username || ""
      );

      setVerificationStatus(
        result.data.verification_status ||
          "pending"
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
        "Enter your Reply link."
      );
      return;
    }

    try {
      setLoading(true);
      setStatus(
        "Submitting verification..."
      );

      const result =
        await supabase
          .from("verifications")
          .insert({
            wallet_address: wallet.toLowerCase(),
            x_follow: true,
            discord_join: true,
            quote_link: quoteLink.trim(),
            reply_link: replyLink.trim(),
            is_verified: false,
          });

      if (result.error) {
        console.error(result.error);

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
  }

  async function withdraw() {
    if (!wallet) {
      setStatus(
        "Connect your wallet first."
      );
      return;
    }

    if (referralEarnings < WITHDRAWAL_USD) {
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
        "https://x.com/VeyroHood",
        "_blank"
      );
    }

    if (type === "discord") {
      window.open(
        "https://discord.gg/utFuXHYHp",
        "_blank"
      );
    }

    if (type === "quote") {
      window.open(
        "https://x.com/VeyroHood/status/2095434542094115048",
        "_blank"
      );
    }

    if (type === "reply") {
      window.open(
        "https://x.com/VeyroHood/status/2095434542094115048",
        "_blank"
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

      <header className="hero">
        <div className="hero-content">

          <div className="badge">
            VEYROHOOD
          </div>

          <h1>
            VeyroHood
          </h1>

          <p className="hero-subtitle">
            Join the whitelist.
            Complete the missions.
            Become an OG.
          </p>

          <button
            className="primary-button"
            onClick={connectWallet}
            disabled={loading}
          >
            {wallet
              ? shortAddress(wallet)
              : "Connect Wallet"}
          </button>

          <p className="status">
            {status}
          </p>

        </div>
      </header>

      <main className="container">

        <section className="stats-grid">

          <div className="stat-card">
            <strong>
              {stats.joined}
            </strong>
            <span>
              Joined
            </span>
          </div>

          <div className="stat-card">
            <strong>
              {ogRemaining}
            </strong>
            <span>
              OG Spots Left
            </span>
          </div>

          <div className="stat-card">
            <strong>
              {NFT_SUPPLY}
            </strong>
            <span>
              NFT Supply
            </span>
          </div>

        </section>

        <section className="section">

          <h2>
            Missions
          </h2>

          <div className="mission-grid">

            <button
              className="mission-card"
              onClick={() =>
                handleMission("x")
              }
            >
              <span>
                01
              </span>
              <strong>
                Follow VeyroHood on X
              </strong>
              <small>
                Open X
              </small>
            </button>

            <button
              className="mission-card"
              onClick={() =>
                handleMission("discord")
              }
            >
              <span>
                02
              </span>
              <strong>
                Join Discord
              </strong>
              <small>
                Open Discord
              </small>
            </button>

            <button
              className="mission-card"
              onClick={() =>
                handleMission("quote")
              }
            >
              <span>
                03
              </span>
              <strong>
                Quote the pinned post
              </strong>
              <small>
                Open pinned post
              </small>
            </button>

            <button
              className="mission-card"
              onClick={() =>
                handleMission("reply")
              }
            >
              <span>
                04
              </span>
              <strong>
                Reply to the pinned post
              </strong>
              <small>
                Open pinned post
              </small>
            </button>

          </div>

        </section>
                <section className="section">

          <h2>
            Verification
          </h2>

          <div className="verification-card">

            <p>
              Submit your mission information
              for verification.
            </p>

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
              onClick={
                submitVerification
              }
              disabled={loading}
            >
              Submit Verification
            </button>

            <p className="verification-status">
              Status: {verificationStatus}
            </p>

          </div>

        </section>

        <section className="section">

          <h2>
            Referral Program
          </h2>

          <div className="referral-card">

            <p>
              Earn {REFERRAL_PERCENT}% from
              qualified referral payments.
            </p>

            <div className="referral-stats">

              <div>
                <strong>
                  {referralCount}
                </strong>
                <span>
                  Referrals
                </span>
              </div>

              <div>
                <strong>
                  ${referralEarnings.toFixed(2)}
                </strong>
                <span>
                  Earnings
                </span>
              </div>

            </div>

            <button
              className="secondary-button"
              onClick={
                copyReferralLink
              }
            >
              Copy Referral Link
            </button>

            <button
              className="secondary-button"
              onClick={withdraw}
            >
              Withdraw
            </button>

          </div>

        </section>

        <section className="section">

          <h2>
            Referral Leaderboard
          </h2>

          <div className="leaderboard">

            {leaderboard.length === 0 ? (
              <p>
                No referral data yet.
              </p>
            ) : (
              leaderboard.map(
                (item, index) => (
                  <div
                    className="leaderboard-row"
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
                      {item.referral_count || 0}
                      {" "}referrals
                    </span>
                  </div>
                )
              )
            )}

          </div>

        </section>

        <section className="section">

          <h2>
            NFT Allocation
          </h2>

          <div className="allocation-card">

            <div>
              <strong>
                1,000 OG
              </strong>

              <p>
                First 1,000 eligible OG
                wallets receive one
                guaranteed NFT.
              </p>
            </div>

            <div>
              <strong>
                9,000 FCFS
              </strong>

              <p>
                Remaining NFTs are
                available to eligible
                submitted wallets on
                a first-come,
                first-served basis.
              </p>
            </div>

            <div>
              <strong>
                {nftRemaining}
              </strong>

              <p>
                Estimated NFT allocation
                remaining.
              </p>
            </div>

          </div>

        </section>

        <section className="section">

          <h2>
            Verification Fee
          </h2>

          <div className="fee-card">

            <strong>
              ${VERIFICATION_USD}
              {" "}worth of native ETH
            </strong>

            <p>
              Payment will be made on
              Robinhood Chain.
            </p>

            <p>
              80% goes to the VeyroHood
              treasury and 20% is
              allocated to the referrer.
            </p>

            <small>
              Treasury:
              {" "}
              {shortAddress(
                TREASURY_ADDRESS
              )}
            </small>

          </div>

        </section>

      </main>

      <footer className="footer">

        <strong>
          VeyroHood
        </strong>

        <p>
          Web3 community • NFT •
          Whitelist
        </p>

        <a
          href="https://x.com/VeyroHood"
          target="_blank"
          rel="noreferrer"
        >
          X
        </a>

        {" • "}

        <a
          href="https://discord.gg/utFuXHYHp"
          target="_blank"
          rel="noreferrer"
        >
          Discord
        </a>

      </footer>

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

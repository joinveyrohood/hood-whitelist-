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

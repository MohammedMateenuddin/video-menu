import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Printer,
  Smartphone,
  Share2,
  RefreshCw,
} from "lucide-react";

import { getCurrentRestaurant } from "../../services/restaurantService";

function QRCodePage() {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const qrRef = useRef(null);

  useEffect(() => {
    loadRestaurant();
  }, []);

  async function loadRestaurant() {
    try {
      setLoading(true);
      setError("");

      const data = await getCurrentRestaurant();

      if (!data?.restaurants) {
        throw new Error("Restaurant information could not be loaded.");
      }

      setRestaurant(data.restaurants);
    } catch (error) {
      console.error("QR restaurant error:", error);

      setError(error?.message || "Unable to load restaurant information.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-9 bg-gray-200 rounded-lg w-40" />

          <div className="h-4 bg-gray-200 rounded w-80 mt-3" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[550px] bg-white border rounded-2xl animate-pulse" />
          <div className="h-[350px] bg-white border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  // =========================================
  // ERROR
  // =========================================

  if (!restaurant) {
    return (
      <div className="bg-white border rounded-2xl p-8">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
          <QrCode size={22} />
        </div>

        <h2 className="text-xl font-semibold mt-5">Unable to load QR code</h2>

        <p className="text-gray-500 mt-2">
          {error || "Restaurant information could not be loaded."}
        </p>

        <button
          type="button"
          onClick={loadRestaurant}
          className="mt-6 inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
        >
          <RefreshCw size={17} />
          Try Again
        </button>
      </div>
    );
  }

  // =========================================
  // MENU URL
  // =========================================

  const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

  const menuUrl = `${baseUrl}/r/${restaurant.slug}`;

  const primaryColor = restaurant.primary_color || "#000000";

  const secondaryColor = restaurant.secondary_color || "#ffffff";

  // =========================================
  // COPY
  // =========================================

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(menuUrl);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Copy link error:", error);

      setError("Unable to copy the menu link.");
    }
  }

  // =========================================
  // DOWNLOAD SVG
  // =========================================

  function downloadSVG() {
    const svg = qrRef.current?.querySelector("svg");

    if (!svg) {
      return;
    }

    const serializer = new XMLSerializer();

    const source = serializer.serializeToString(svg);

    const blob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `${restaurant.slug}-videomenu-qr.svg`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  // =========================================
  // DOWNLOAD PNG
  // =========================================

  function downloadPNG() {
    const svg = qrRef.current?.querySelector("svg");

    if (!svg) {
      return;
    }

    const serializer = new XMLSerializer();

    const source = serializer.serializeToString(svg);

    const svgBlob = new Blob([source], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(svgBlob);

    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");

      const scale = 3;

      canvas.width = 1000 * scale;
      canvas.height = 1000 * scale;

      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle = "#ffffff";

      context.fillRect(0, 0, canvas.width, canvas.height);

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");

      const link = document.createElement("a");

      link.href = pngUrl;

      link.download = `${restaurant.slug}-videomenu-qr.png`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);
    };

    image.src = url;
  }

  // =========================================
  // PRINT
  // =========================================

  function printQR() {
    window.print();
  }

  // =========================================
  // SHARE
  // =========================================

  async function shareMenu() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: restaurant.name,
          text: `View ${restaurant.name}'s VideoMenu`,
          url: menuUrl,
        });

        return;
      }

      await copyLink();
    } catch (error) {
      console.log("Share cancelled:", error);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
            style={{
              backgroundColor: primaryColor,
            }}
          >
            <QrCode size={21} />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">QR Code</h1>

            <p className="text-gray-500 mt-1">
              Let customers scan and instantly open your VideoMenu.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={shareMenu}
            className="inline-flex items-center justify-center gap-2 border bg-white px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            <Share2 size={17} />
            Share
          </button>

          <button
            type="button"
            onClick={printQR}
            className="inline-flex items-center justify-center gap-2 border bg-white px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            <Printer size={17} />
            Print
          </button>
        </div>
      </div>

      {/* =========================================
          ERROR
      ========================================== */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* =========================================
          MAIN
      ========================================== */}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* =========================================
            QR CARD
        ========================================== */}

        <div className="xl:col-span-3 bg-white border rounded-2xl overflow-hidden">
          <div
            className="p-6 sm:p-8 flex flex-col items-center"
            style={{
              background: `linear-gradient(
                135deg,
                ${primaryColor}08,
                ${secondaryColor}40
              )`,
            }}
          >
            {/* Restaurant identity */}

            <div className="flex items-center gap-3 mb-7">
              {restaurant.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-12 h-12 rounded-xl object-cover border"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{
                    backgroundColor: primaryColor,
                  }}
                >
                  {restaurant.name?.charAt(0)?.toUpperCase()}
                </div>
              )}

              <div>
                <p className="font-semibold">{restaurant.name}</p>

                <p className="text-xs text-gray-500 mt-0.5">VideoMenu</p>
              </div>
            </div>

            {/* QR */}

            <div
              ref={qrRef}
              className="bg-white p-6 sm:p-8 rounded-2xl border shadow-sm"
            >
              <QRCodeSVG
                value={menuUrl}
                size={280}
                level="H"
                includeMargin
                fgColor={primaryColor}
                bgColor="#ffffff"
              />
            </div>

            <h2 className="text-2xl font-bold mt-7 text-center">
              Scan to View Menu
            </h2>

            <p className="text-gray-500 text-sm mt-2 text-center max-w-sm">
              Customers can scan this QR code with their phone camera to open
              your interactive VideoMenu.
            </p>

            {/* Download buttons */}

            <div className="flex flex-wrap justify-center gap-3 mt-7">
              <button
                type="button"
                onClick={downloadPNG}
                className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
              >
                <Download size={17} />
                Download PNG
              </button>

              <button
                type="button"
                onClick={downloadSVG}
                className="inline-flex items-center gap-2 border bg-white px-5 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
              >
                <Download size={17} />
                SVG
              </button>
            </div>
          </div>
        </div>

        {/* =========================================
            RIGHT SIDE
        ========================================== */}

        <div className="xl:col-span-2 space-y-6">
          {/* MENU LINK */}

          <div className="bg-white border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <ExternalLink size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-lg">Your VideoMenu Link</h2>

                <p className="text-sm text-gray-500 mt-1">
                  Share this link anywhere.
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <div className="flex-1 min-w-0 bg-gray-50 border rounded-xl px-4 py-3 text-sm truncate">
                {menuUrl}
              </div>

              <button
                type="button"
                onClick={copyLink}
                className="w-12 shrink-0 border rounded-xl flex items-center justify-center hover:bg-gray-50 transition"
                title="Copy menu link"
              >
                {copied ? (
                  <Check size={18} className="text-green-600" />
                ) : (
                  <Copy size={18} />
                )}
              </button>
            </div>

            {copied && (
              <p className="text-sm text-green-600 mt-3">
                Menu link copied to clipboard.
              </p>
            )}

            <div className="flex flex-wrap gap-4 mt-5">
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
              >
                Open VideoMenu
                <ExternalLink size={15} />
              </a>

              <button
                type="button"
                onClick={shareMenu}
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
              >
                Share link
                <Share2 size={15} />
              </button>
            </div>
          </div>

          {/* HOW IT WORKS */}

          <div className="bg-white border rounded-2xl p-5 sm:p-6">
            <h2 className="font-semibold text-lg">How it works</h2>

            <div className="mt-5 space-y-5">
              <div className="flex gap-4">
                <div
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{
                    backgroundColor: primaryColor,
                  }}
                >
                  1
                </div>

                <div>
                  <p className="font-medium">Download your QR</p>

                  <p className="text-sm text-gray-500 mt-1">
                    Download the QR as PNG or SVG and print it.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{
                    backgroundColor: primaryColor,
                  }}
                >
                  2
                </div>

                <div>
                  <p className="font-medium">Place it around your restaurant</p>

                  <p className="text-sm text-gray-500 mt-1">
                    Put it on tables, counters, stands or promotional material.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{
                    backgroundColor: primaryColor,
                  }}
                >
                  3
                </div>

                <div>
                  <p className="font-medium">Customers scan</p>

                  <p className="text-sm text-gray-500 mt-1">
                    Their phone opens your VideoMenu instantly — no app or
                    login.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{
                    backgroundColor: primaryColor,
                  }}
                >
                  4
                </div>

                <div>
                  <p className="font-medium">They explore your dishes</p>

                  <p className="text-sm text-gray-500 mt-1">
                    Customers swipe through your visual food menu.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS */}

          <div className="bg-white border rounded-2xl p-5 sm:p-6">
            <h2 className="font-semibold text-lg">Quick Actions</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 border rounded-xl p-4 hover:bg-gray-50 transition"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Smartphone size={17} />
                </div>

                <div>
                  <p className="text-sm font-medium">Preview Menu</p>

                  <p className="text-xs text-gray-500 mt-1">Customer view</p>
                </div>
              </a>

              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-3 border rounded-xl p-4 hover:bg-gray-50 transition text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  {copied ? (
                    <Check size={17} className="text-green-600" />
                  ) : (
                    <Copy size={17} />
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium">Copy Link</p>

                  <p className="text-xs text-gray-500 mt-1">Share anywhere</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          PRINT-ONLY CARD
      ========================================== */}

      <div className="hidden print:flex fixed inset-0 bg-white items-center justify-center">
        <div className="text-center">
          <div className="mb-6">
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-20 h-20 rounded-xl object-cover mx-auto"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-xl mx-auto flex items-center justify-center text-white text-2xl font-bold"
                style={{
                  backgroundColor: primaryColor,
                }}
              >
                {restaurant.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>

          <h1 className="text-4xl font-bold">{restaurant.name}</h1>

          <p className="text-lg mt-3">Scan to View Our VideoMenu</p>

          <div className="mt-8">
            <QRCodeSVG value={menuUrl} size={400} level="H" includeMargin />
          </div>

          <p className="text-sm mt-6">{menuUrl}</p>
        </div>
      </div>
    </div>
  );
}

export default QRCodePage;

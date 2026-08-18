import { useEffect, useState } from "react";
import {
  Save,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Palette,
  Store,
  Eye,
  FileText,
  Video,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { getCurrentRestaurant } from "../../services/restaurantService";
import { uploadMenuMedia, deleteMenuMedia } from "../../services/storageService";

function Settings() {
  const [restaurantId, setRestaurantId] = useState(null);

  const [restaurantSlug, setRestaurantSlug] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    address: "",
    primary_color: "#111111",
    secondary_color: "#ffffff",
    logo_url: "",
    pdf_menu_url: "",
    intro_video_url: "",
  });

  const [originalForm, setOriginalForm] = useState(null);

  const [logoFile, setLogoFile] = useState(null);
  const [introVideoFile, setIntroVideoFile] = useState(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIntroVideo, setUploadingIntroVideo] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    loadRestaurant();
  }, []);

  // =========================================
  // LOAD RESTAURANT
  // =========================================

  async function loadRestaurant() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const data = await getCurrentRestaurant();

      const restaurant = data?.restaurants;

      if (!restaurant?.id) {
        throw new Error("Restaurant information could not be loaded.");
      }

      const restaurantForm = {
        name: restaurant.name || "",
        description: restaurant.description || "",
        phone: restaurant.phone || "",
        address: restaurant.address || "",
        primary_color: restaurant.primary_color || "#111111",
        secondary_color: restaurant.secondary_color || "#ffffff",
        logo_url: restaurant.logo_url || "",
        pdf_menu_url: restaurant.pdf_menu_url || "",
        intro_video_url: restaurant.intro_video_url || "",
      };

      setRestaurantId(restaurant.id);

      setRestaurantSlug(restaurant.slug || "");

      setForm(restaurantForm);

      setOriginalForm(restaurantForm);
    } catch (error) {
      console.error("Load restaurant error:", error);

      setError(error?.message || "Unable to load restaurant settings.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // CHANGE HANDLER
  // =========================================

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
    setError("");
  }

  // =========================================
  // UNSAVED CHANGES
  // =========================================

  const hasChanges =
    originalForm && JSON.stringify(form) !== JSON.stringify(originalForm);

  // =========================================
  // LOGO UPLOAD
  // =========================================

  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);

  async function handlePdfUpload(file) {
    if (!file || !restaurantId) return;

    if (file.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("PDF must be smaller than 10MB.");
      return;
    }

    try {
      setUploadingPdf(true);
      setError("");
      setMessage("");

      const url = await uploadMenuMedia(file, restaurantId, "pdfs");

      setForm((prev) => ({ ...prev, pdf_menu_url: url }));
      setPdfFile(file);
      setMessage("PDF menu uploaded successfully. Save your changes to keep it.");
    } catch (error) {
      console.error("PDF upload error:", error);
      setError(error?.message || "Unable to upload PDF.");
    } finally {
      setUploadingPdf(false);
    }
  }

  function removePdf() {
    setForm((prev) => ({ ...prev, pdf_menu_url: "" }));
    setPdfFile(null);
    setMessage("");
  }

  async function handleLogoUpload(file) {
    if (!file || !restaurantId) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");

      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("Logo must be smaller than 5MB.");

      return;
    }

    try {
      setUploadingLogo(true);
      setError("");
      setMessage("");

      const url = await uploadMenuMedia(file, restaurantId, "logo");

      setForm((previous) => ({
        ...previous,
        logo_url: url,
      }));

      setLogoFile(file);

      setMessage("Logo uploaded successfully. Save your changes to keep it.");
    } catch (error) {
      console.error("Logo upload error:", error);

      setError(error?.message || "Unable to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  // =========================================
  // REMOVE LOGO
  // =========================================

  function removeLogo() {
    setForm((previous) => ({
      ...previous,
      logo_url: "",
    }));

    setLogoFile(null);

    setMessage("");
  }

  // =========================================
  // INTRO VIDEO UPLOAD
  // =========================================

  async function handleIntroVideoUpload(file) {
    if (!file || !restaurantId) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("Intro video must be smaller than 50MB.");
      return;
    }

    try {
      setUploadingIntroVideo(true);
      setError("");
      setMessage("");

      const url = await uploadMenuMedia(file, restaurantId, "intro");

      setForm((prev) => ({ ...prev, intro_video_url: url }));
      setIntroVideoFile(file);
      setMessage("Intro video uploaded successfully. Save your changes to keep it.");
    } catch (error) {
      console.error("Intro video upload error:", error);
      setError(error?.message || "Unable to upload intro video.");
    } finally {
      setUploadingIntroVideo(false);
    }
  }

  function removeIntroVideo() {
    setForm((prev) => ({ ...prev, intro_video_url: "" }));
    setIntroVideoFile(null);
    setMessage("");
  }

  // =========================================
  // RESET
  // =========================================

  function resetChanges() {
    if (!originalForm) {
      return;
    }

    setForm({
      ...originalForm,
    });

    setLogoFile(null);
    setPdfFile(null);
    setIntroVideoFile(null);
    setMessage("");
    setError("");
  }

  // =========================================
  // VALIDATE
  // =========================================

  function validateForm() {
    if (!form.name.trim()) {
      return "Restaurant name is required.";
    }

    if (form.name.trim().length > 100) {
      return "Restaurant name must be 100 characters or less.";
    }

    if (form.description.length > 500) {
      return "Description must be 500 characters or less.";
    }

    if (form.phone.length > 30) {
      return "Phone number is too long.";
    }

    if (form.address.length > 300) {
      return "Address must be 300 characters or less.";
    }

    const colorRegex = /^#[0-9A-Fa-f]{6}$/;

    if (!colorRegex.test(form.primary_color)) {
      return "Primary color must be a valid HEX color.";
    }

    if (!colorRegex.test(form.secondary_color)) {
      return "Secondary color must be a valid HEX color.";
    }

    return null;
  }

  // =========================================
  // SAVE
  // =========================================

  async function handleSubmit(e) {
    e.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);

      return;
    }

    if (!restaurantId) {
      setError("Restaurant ID is missing.");

      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("restaurants")
        .update({
          name: form.name.trim(),
          description: form.description.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          primary_color: form.primary_color.toUpperCase(),
          secondary_color: form.secondary_color.toUpperCase(),
          logo_url: form.logo_url || null,
          pdf_menu_url: form.pdf_menu_url || null,
          intro_video_url: form.intro_video_url || null,
        })
        .eq("id", restaurantId);

      if (error) {
        throw error;
      }

      if (
        originalForm &&
        originalForm.logo_url &&
        originalForm.logo_url !== form.logo_url
      ) {
        await deleteMenuMedia(originalForm.logo_url);
      }

      if (
        originalForm &&
        originalForm.pdf_menu_url &&
        originalForm.pdf_menu_url !== form.pdf_menu_url
      ) {
        await deleteMenuMedia(originalForm.pdf_menu_url);
      }
      
      if (
        originalForm &&
        originalForm.intro_video_url &&
        originalForm.intro_video_url !== form.intro_video_url
      ) {
        await deleteMenuMedia(originalForm.intro_video_url);
      }

      const savedForm = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        primary_color: form.primary_color.toUpperCase(),
        secondary_color: form.secondary_color.toUpperCase(),
      };

      setForm(savedForm);

      setOriginalForm(savedForm);

      setMessage("Restaurant settings saved successfully.");
    } catch (error) {
      console.error("Save settings error:", error);

      setError(error?.message || "Unable to save restaurant settings.");
    } finally {
      setSaving(false);
    }
  }

  // =========================================
  // CUSTOMER MENU URL
  // =========================================

  const menuUrl = restaurantSlug
    ? `${
        import.meta.env.VITE_PUBLIC_URL || window.location.origin
      }/r/${restaurantSlug}`
    : null;

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="animate-pulse">
          <div className="h-9 bg-gray-200 rounded-lg w-40" />
          <div className="h-4 bg-gray-200 rounded w-80 mt-3" />
        </div>

        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-64 bg-white border rounded-2xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl pb-12">
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">
              <Store size={19} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          </div>

          <p className="text-gray-500 mt-3">
            Customize how your restaurant appears across VideoMenu.
          </p>
        </div>

        {menuUrl && (
          <a
            href={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 border bg-white px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            <Eye size={17} />
            Preview Menu
          </a>
        )}
      </div>

      {/* =========================================
          MESSAGES
      ========================================== */}

      {error && (
        <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <div className="text-sm">
            <p className="font-semibold">Something went wrong</p>

            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {message && (
        <div className="mb-5 flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />

          <p className="text-sm">{message}</p>
        </div>
      )}

      {/* =========================================
          FORM
      ========================================== */}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* =========================================
            RESTAURANT INFORMATION
        ========================================== */}

        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Store size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-lg">
                  Restaurant Information
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Basic information displayed to your customers.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* NAME */}

            <div>
              <label className="block text-sm font-medium mb-2">
                Restaurant Name
              </label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                maxLength={100}
                required
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                placeholder="Restaurant name"
              />

              <p className="text-xs text-gray-400 mt-1.5 text-right">
                {form.name.length}/100
              </p>
            </div>

            {/* DESCRIPTION */}

            <div>
              <div className="flex justify-between">
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>

                <span className="text-xs text-gray-400">
                  {form.description.length}/500
                </span>
              </div>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                maxLength={500}
                rows={4}
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black resize-none"
                placeholder="Tell customers about your restaurant..."
              />
            </div>

            {/* PHONE + ADDRESS */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Phone size={15} />
                  Phone
                </label>

                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  type="tel"
                  maxLength={30}
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <MapPin size={15} />
                  Address
                </label>

                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  maxLength={300}
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  placeholder="Restaurant address"
                />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================
            LOGO
        ========================================== */}

        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <ImageIcon size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-lg">Restaurant Logo</h2>

                <p className="text-sm text-gray-500 mt-1">
                  Used throughout your customer-facing VideoMenu.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Logo preview */}

              <div className="shrink-0">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Restaurant logo"
                    className="w-28 h-28 rounded-2xl object-cover border shadow-sm"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-gray-100 border flex items-center justify-center">
                    <ImageIcon size={32} className="text-gray-400" />
                  </div>
                )}
              </div>

              <div>
                <label className="inline-flex items-center gap-2 bg-black text-white px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-800 transition font-medium">
                  <Upload size={17} />

                  {uploadingLogo ? "Uploading..." : "Upload Logo"}

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                  />
                </label>

                {form.logo_url && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="ml-2 px-4 py-3 rounded-xl border text-sm font-medium hover:bg-gray-50"
                  >
                    Remove
                  </button>
                )}

                {logoFile && (
                  <p className="text-xs text-gray-500 mt-3">{logoFile.name}</p>
                )}

                <p className="text-xs text-gray-400 mt-3">
                  PNG, JPG or WebP. Maximum 5MB. A square image works best.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================
            PDF MENU
        ========================================== */}

        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <FileText size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-lg">PDF Menu</h2>

                <p className="text-sm text-gray-500 mt-1">
                  Allow customers to view or download a traditional PDF menu.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="shrink-0">
                <div className="w-28 h-28 rounded-2xl bg-gray-100 border flex items-center justify-center">
                  <FileText size={32} className={form.pdf_menu_url ? "text-red-500" : "text-gray-400"} />
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 bg-black text-white px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-800 transition font-medium">
                  <Upload size={17} />

                  {uploadingPdf ? "Uploading..." : "Upload PDF Menu"}

                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={uploadingPdf}
                    onChange={(e) => handlePdfUpload(e.target.files?.[0])}
                  />
                </label>

                {form.pdf_menu_url && (
                  <>
                    <a
                      href={form.pdf_menu_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium hover:bg-gray-50"
                    >
                      <Eye size={16} />
                      View
                    </a>
                    <button
                      type="button"
                      onClick={removePdf}
                      className="ml-2 px-4 py-3 rounded-xl border text-sm font-medium hover:bg-gray-50 text-red-600"
                    >
                      Remove
                    </button>
                  </>
                )}

                {pdfFile && (
                  <p className="text-xs text-gray-500 mt-3">{pdfFile.name}</p>
                )}

                <p className="text-xs text-gray-400 mt-3">
                  PDF only. Maximum 10MB.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================
            INTRO VIDEO
        ========================================== */}

        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Video size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-lg">Intro Video</h2>

                <p className="text-sm text-gray-500 mt-1">
                  A video that plays automatically when customers scan your menu.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="shrink-0">
                <div className="w-28 h-28 rounded-2xl bg-gray-100 border flex items-center justify-center overflow-hidden">
                  {form.intro_video_url ? (
                    <video src={form.intro_video_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <Video size={32} className="text-gray-400" />
                  )}
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 bg-black text-white px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-800 transition font-medium">
                  <Upload size={17} />

                  {uploadingIntroVideo ? "Uploading..." : "Upload Intro Video"}

                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    disabled={uploadingIntroVideo}
                    onChange={(e) => handleIntroVideoUpload(e.target.files?.[0])}
                  />
                </label>

                {form.intro_video_url && (
                  <button
                    type="button"
                    onClick={removeIntroVideo}
                    className="ml-2 px-4 py-3 rounded-xl border text-sm font-medium hover:bg-gray-50 text-red-600"
                  >
                    Remove
                  </button>
                )}

                {introVideoFile && (
                  <p className="text-xs text-gray-500 mt-3">{introVideoFile.name}</p>
                )}

                <p className="text-xs text-gray-400 mt-3">
                  MP4, MOV, or WebM. Maximum 50MB. Vertical (9:16) format works best.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================
            BRANDING
        ========================================== */}

        <section className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Palette size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-lg">Branding</h2>

                <p className="text-sm text-gray-500 mt-1">
                  Customize your VideoMenu colors.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PRIMARY */}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Primary Color
                </label>

                <div className="flex gap-3">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) =>
                      setForm((previous) => ({
                        ...previous,
                        primary_color: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-14 h-12 rounded-xl border cursor-pointer p-1"
                  />

                  <input
                    type="text"
                    name="primary_color"
                    value={form.primary_color}
                    onChange={handleChange}
                    maxLength={7}
                    className="flex-1 border rounded-xl px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    placeholder="#111111"
                  />
                </div>
              </div>

              {/* SECONDARY */}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Secondary Color
                </label>

                <div className="flex gap-3">
                  <input
                    type="color"
                    value={form.secondary_color}
                    onChange={(e) =>
                      setForm((previous) => ({
                        ...previous,
                        secondary_color: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-14 h-12 rounded-xl border cursor-pointer p-1"
                  />

                  <input
                    type="text"
                    name="secondary_color"
                    value={form.secondary_color}
                    onChange={handleChange}
                    maxLength={7}
                    className="flex-1 border rounded-xl px-4 py-3 uppercase outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
            </div>

            {/* LIVE PREVIEW */}

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Live Preview</p>

                <span className="text-xs text-gray-400">
                  Customer appearance
                </span>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white min-h-[190px]"
                style={{
                  background: `linear-gradient(
                    135deg,
                    ${form.primary_color},
                    ${form.secondary_color}
                  )`,
                }}
              >
                <div className="absolute inset-0 bg-black/10" />

                <div className="relative">
                  <div className="flex items-center gap-3">
                    {form.logo_url ? (
                      <img
                        src={form.logo_url}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                        {form.name?.charAt(0)?.toUpperCase() || "R"}
                      </div>
                    )}

                    <div>
                      <p className="font-bold text-lg">
                        {form.name || "Restaurant Name"}
                      </p>

                      <p className="text-xs text-white/70">VideoMenu</p>
                    </div>
                  </div>

                  {form.description && (
                    <p className="mt-6 max-w-lg text-sm text-white/75">
                      {form.description}
                    </p>
                  )}

                  <div className="flex gap-2 mt-5">
                    <span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/10 text-xs">
                      Starters
                    </span>

                    <span className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-medium">
                      Main Course
                    </span>

                    <span className="px-3 py-1.5 rounded-full bg-white/15 border border-white/10 text-xs">
                      Desserts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================
            SAVE BAR
        ========================================== */}

        <div className="sticky bottom-4 z-20">
          <div className="bg-white/95 backdrop-blur-md border shadow-lg rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {hasChanges ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />

                  <p className="text-sm text-gray-600">
                    You have unsaved changes.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} className="text-green-600" />

                  <p className="text-sm text-gray-500">All changes saved.</p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {hasChanges && (
                <button
                  type="button"
                  onClick={resetChanges}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium hover:bg-gray-50 transition"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
              )}

              <button
                type="submit"
                disabled={saving || uploadingLogo || !hasChanges}
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Save size={17} />

                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default Settings;

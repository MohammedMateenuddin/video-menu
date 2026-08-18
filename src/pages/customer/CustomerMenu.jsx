import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Phone,
  MapPin,
  Star,
  Share2,
  ChevronDown,
  UtensilsCrossed,
  Info,
  ArrowRight,
  RefreshCw,
  FileText,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

export default function CustomerMenu() {
  const { restaurantSlug } = useParams();

  const slug =
    restaurantSlug ||
    (window.location.hostname.split(".")[0] !== "www"
      ? window.location.hostname.split(".")[0]
      : null);

  const viewCountedRef = useRef(false);

  const [restaurant, setRestaurant] = useState(null);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeIndex, setActiveIndex] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);

  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  const [isEndScreen, setIsEndScreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const videoRefs = useRef({});
  const sectionRefs = useRef({});
  const endScreenRef = useRef(null);

  // =========================================
  // LOAD RESTAURANT + MENU
  // =========================================

  useEffect(() => {
    loadRestaurant();
  }, [slug]);

  async function loadRestaurant() {
    try {
      setLoading(true);
      setError("");

      if (!slug) {
        setError("Restaurant not found.");
        return;
      }

      // -----------------------------------------
      // RESTAURANT
      // -----------------------------------------

      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (restaurantError) {
        throw restaurantError;
      }

      if (!restaurantData) {
        setError("Restaurant not found.");
        return;
      }

      setRestaurant(restaurantData);

      // Increment view count in the background securely (only once per session)
      if (restaurantData?.id && !viewCountedRef.current) {
        viewCountedRef.current = true;
        supabase
          .rpc("increment_view_count", {
            restaurant_id_param: restaurantData.id,
          })
          .then(({ error }) => {
            if (error) console.error("View count error:", error);
          });
      }

      if (restaurantData.is_active === false) {
        setRestaurant(restaurantData);
        setError("This restaurant's VideoMenu is currently unavailable.");
        return;
      }
      setRestaurant(restaurantData);

      // -----------------------------------------
      // AVAILABLE MENU ITEMS
      // -----------------------------------------

      const { data: menuItems, error: menuError } = await supabase
        .from("menu_items")
        .select(
          `
            *,
            categories (
              id,
              name
            )
          `,
        )
        .eq("restaurant_id", restaurantData.id)
        .eq("is_available", true)
        .order("display_order", {
          ascending: true,
        });

      if (menuError) {
        throw menuError;
      }

      setItems(menuItems || []);
    } catch (err) {
      console.error("Customer menu error:", err);

      setError(err?.message || "Unable to load this restaurant menu.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // VIDEO REFERENCES
  // =========================================

  function setVideoRef(id, element) {
    if (element) {
      videoRefs.current[id] = element;
    } else {
      delete videoRefs.current[id];
    }
  }

  // =========================================
  // SECTION REFERENCES
  // =========================================

  function setSectionRef(id, element) {
    if (element) {
      sectionRefs.current[id] = element;
    } else {
      delete sectionRefs.current[id];
    }
  }

  // =========================================
  // PLAY / PAUSE
  // =========================================

  function togglePlay(id) {
    const video = videoRefs.current[id];

    if (!video) {
      return;
    }

    if (video.paused) {
      video
        .play()
        .then(() => {
          setPaused(false);
        })
        .catch((err) => {
          console.error("Video play error:", err);
        });
    } else {
      video.pause();
      setPaused(true);
    }
  }

  // =========================================
  // VIDEO PROGRESS
  // =========================================

  function handleVideoTimeUpdate(event, index) {
    if (isEndScreen) {
      return;
    }

    if (index !== activeIndex) {
      return;
    }

    const video = event.currentTarget;

    if (!video.duration || !Number.isFinite(video.duration)) {
      return;
    }

    const progress = (video.currentTime / video.duration) * 100;

    setVideoProgress(Math.min(Math.max(progress, 0), 100));
  }

  // =========================================
  // VIDEO PLAY
  // =========================================

  function handleVideoPlay(index) {
    if (index !== activeIndex) {
      return;
    }

    setPaused(false);
    setIsEndScreen(false);
  }

  // =========================================
  // VIDEO END
  // =========================================

  function handleVideoEnded(index) {
    if (index !== activeIndex) {
      return;
    }

    setVideoProgress(100);
    setPaused(true);
  }

  // =========================================
  // MUTE
  // =========================================

  function toggleMute() {
    const nextMuted = !muted;

    setMuted(nextMuted);

    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.muted = nextMuted;
      }
    });
  }

  // =========================================
  // PAUSE ALL VIDEOS
  // =========================================

  function pauseAllVideos() {
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.pause();
      }
    });
  }

  // =========================================
  // PLAY ACTIVE VIDEO
  // =========================================

  function playActiveVideo(index) {
    const item = items[index];

    if (!item) {
      return;
    }

    const video = videoRefs.current[item.id];

    if (!video) {
      return;
    }

    video.muted = muted;

    video
      .play()
      .then(() => {
        setPaused(false);
      })
      .catch(() => {
        // Browser autoplay restriction.
        setPaused(true);
      });
  }

  // =========================================
  // INTERSECTION OBSERVER
  // =========================================

  useEffect(() => {
    if (!items.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          // -----------------------------------------
          // END SCREEN
          // -----------------------------------------

          if (entry.target.dataset.type === "end") {
            pauseAllVideos();

            setIsEndScreen(true);
            setPaused(true);

            return;
          }

          // -----------------------------------------
          // MENU ITEM
          // -----------------------------------------

          const index = Number(entry.target.dataset.index);

          if (!Number.isFinite(index)) {
            return;
          }

          setIsEndScreen(false);
          setActiveIndex(index);
          setVideoProgress(0);
          setPaused(false);

          // Pause every other video.
          Object.entries(videoRefs.current).forEach(([videoId, video]) => {
            const otherIndex = items.findIndex((item) => item.id === videoId);

            if (otherIndex !== index) {
              video.pause();
            }
          });

          // Start active video.
          setTimeout(() => {
            playActiveVideo(index);
          }, 50);
        });
      },
      {
        threshold: 0.65,
      },
    );

    Object.values(sectionRefs.current).forEach((section) => {
      if (section) {
        observer.observe(section);
      }
    });

    if (endScreenRef.current) {
      observer.observe(endScreenRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [items, muted]);

  // =========================================
  // RESET WHEN MENU LOADS
  // =========================================

  useEffect(() => {
    if (!items.length) {
      return;
    }

    setActiveIndex(0);
    setVideoProgress(0);
    setIsEndScreen(false);
  }, [items]);

  // =========================================
  // SHARE MENU
  // =========================================

  async function shareMenu() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: restaurant?.name || "VideoMenu",
          text: `Check out ${restaurant?.name || "this restaurant"}'s menu`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);

        setShareMessage("Menu link copied!");

        setTimeout(() => {
          setShareMessage("");
        }, 2000);
      }
    } catch (error) {
      // User cancelled native share.
      console.log("Share cancelled:", error);
    }
  }

  // =========================================
  // SCROLL TO NEXT
  // =========================================

  function scrollToNext() {
    const nextIndex = activeIndex + 1;

    if (nextIndex >= items.length) {
      endScreenRef.current?.scrollIntoView({
        behavior: "smooth",
      });

      return;
    }

    const nextItem = items[nextIndex];

    const nextSection = sectionRefs.current[nextItem?.id];

    nextSection?.scrollIntoView({
      behavior: "smooth",
    });
  }

  // =========================================
  // COLORS
  // =========================================

  const primaryColor = restaurant?.primary_color || "#111111";

  const secondaryColor = restaurant?.secondary_color || "#333333";

  // =========================================
  // CURRENT ITEM
  // =========================================

  const currentItem = items[activeIndex];

  const currentCategory =
    currentItem?.categories?.name || currentItem?.category_name || "";

  // =========================================
  // CATEGORIES LIST
  // =========================================

  const categoriesList = items.reduce((acc, item) => {
    const catName = item.categories?.name || item.category_name;
    const catId = item.category_id || item.categories?.id;
    if (catName && catId && !acc.find((c) => c.id === catId)) {
      acc.push({ id: catId, name: catName, firstItemId: item.id });
    }
    return acc;
  }, []);

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-9 h-9 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />

          <p className="text-white/60 text-sm">Loading menu...</p>
        </div>
      </div>
    );
  }

  // =========================================
  // ERROR
  // =========================================

  if (error || !restaurant) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-6">
            <UtensilsCrossed size={28} className="text-white/60" />
          </div>

          <h1 className="text-2xl font-bold">Menu unavailable</h1>

          <p className="text-white/50 mt-3">
            {error || "We couldn't find this restaurant."}
          </p>
        </div>
      </div>
    );
  }

  // =========================================
  // EMPTY MENU
  // =========================================

  if (items.length === 0) {
    return (
      <div
        className="min-h-[100dvh] text-white flex items-center justify-center px-6"
        style={{
          background: `linear-gradient(
            135deg,
            ${primaryColor},
            ${secondaryColor}
          )`,
        }}
      >
        <div className="text-center max-w-md">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-24 h-24 rounded-full object-cover mx-auto mb-6 border-4 border-white/20"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl font-bold border-4 border-white/20"
              style={{
                backgroundColor: primaryColor,
              }}
            >
              {restaurant.name?.charAt(0)?.toUpperCase()}
            </div>
          )}

          <h1 className="text-3xl font-bold">{restaurant.name}</h1>

          <p className="text-white/70 mt-3">
            The menu is currently being prepared. Please check back soon.
          </p>
        </div>
      </div>
    );
  }
  // =========================================
  // CUSTOMER MENU
  // =========================================

  return (
    <div
      className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory bg-black text-white"
      style={{
        backgroundColor: "#000000",
      }}
    >
      {/* =========================================
          MENU ITEMS
      ========================================== */}

      {items.map((item, index) => {
        const isActive = index === activeIndex;

        const hasVideo = Boolean(item.video_url);

        const hasImage = Boolean(item.image_url);

        const categoryName =
          item?.categories?.name || item?.category_name || "";

        return (
          <section
            key={item.id}
            ref={(element) => setSectionRef(item.id, element)}
            data-index={index}
            data-type="item"
            className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black"
          >
            {/* =========================================
                BACKGROUND MEDIA
            ========================================== */}

            {hasVideo ? (
              <video
                ref={(element) => setVideoRef(item.id, element)}
                src={item.video_url}
                poster={item.image_url || undefined}
                muted={muted}
                playsInline
                preload={isActive ? "auto" : "metadata"}
                loop
                onTimeUpdate={(event) => handleVideoTimeUpdate(event, index)}
                onPlay={() => handleVideoPlay(index)}
                onClick={() => togglePlay(item.id)}
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
              />
            ) : hasImage ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background: `linear-gradient(
                    135deg,
                    ${primaryColor},
                    ${secondaryColor}
                  )`,
                }}
              >
                <UtensilsCrossed size={70} className="text-white/20" />
              </div>
            )}

            {/* =========================================
                DARK GRADIENT
            ========================================== */}

            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90 pointer-events-none" />

            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

            {/* =========================================
                TOP HEADER
            ========================================== */}

            <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                {/* Restaurant */}

                <div className="flex items-center gap-3 min-w-0">
                  {restaurant.logo_url ? (
                    <img
                      src={restaurant.logo_url}
                      alt={restaurant.name}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover border border-white/30 shadow-lg"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold border border-white/20 shadow-lg"
                      style={{
                        backgroundColor: primaryColor,
                      }}
                    >
                      {restaurant.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-semibold text-sm sm:text-base truncate max-w-[190px] sm:max-w-xs">
                      {restaurant.name}
                    </p>

                    {categoryName && (
                      <p className="text-xs text-white/60 mt-0.5">
                        {categoryName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Top actions */}

                <div className="flex items-center gap-2">
                  {restaurant.pdf_menu_url && (
                    <a
                      href={restaurant.pdf_menu_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition"
                      title="View PDF Menu"
                    >
                      <FileText size={18} />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowInfo(true)}
                    aria-label="Restaurant info"
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition"
                  >
                    <Info size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={shareMenu}
                    aria-label="Share menu"
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition"
                  >
                    <Share2 size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition"
                  >
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </div>
              </div>

              {/* Progress */}

              <div className="mt-4 w-full h-0.5 rounded-full bg-white/25 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${videoProgress}%`,
                    backgroundColor: "#ffffff",
                  }}
                />
              </div>

              {/* Categories Filter */}

              {categoriesList.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {categoriesList.map((cat) => {
                    const isSelected = categoryName === cat.name;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetSection = sectionRefs.current[cat.firstItemId];
                          if (targetSection) {
                            targetSection.scrollIntoView({ behavior: "smooth" });
                          }
                        }}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-md transition ${
                          isSelected
                            ? "bg-white text-black border-white"
                            : "bg-black/40 text-white/90 border-white/20 hover:bg-black/60"
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* =========================================
                PLAY / PAUSE
            ========================================== */}

            {hasVideo && (
              <button
                type="button"
                onClick={() => togglePlay(item.id)}
                aria-label={paused ? "Play video" : "Pause video"}
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-16 h-16 rounded-full bg-black/35 backdrop-blur-md border border-white/20 flex items-center justify-center transition ${
                  paused
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-90 hover:opacity-100"
                }`}
              >
                {paused ? (
                  <Play size={27} fill="white" />
                ) : (
                  <Pause size={25} fill="white" />
                )}
              </button>
            )}

            {/* =========================================
                DISH INFORMATION
            ========================================== */}

            <div className="absolute left-0 right-0 bottom-0 z-20 px-5 sm:px-7 pb-7 sm:pb-10">
              <div className="max-w-2xl">
                {/* Category */}

                {categoryName && (
                  <div className="mb-3">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md border border-white/10"
                      style={{
                        backgroundColor: `${primaryColor}CC`,
                      }}
                    >
                      {categoryName}
                    </span>
                  </div>
                )}

                {/* Bestseller */}

                {item.is_bestseller && (
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1.5 bg-yellow-400 text-black px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      <Star size={13} fill="currentColor" />
                      BESTSELLER
                    </span>
                  </div>
                )}

                {/* Dish name */}

                <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight drop-shadow-lg">
                    {item.name}
                  </h1>

                  <span className="text-2xl sm:text-3xl font-bold drop-shadow-lg text-white/90 pb-1">
                    ₹{Number(item.price || 0).toFixed(0)}
                  </span>
                </div>

                {/* Description */}

                {item.description && (
                  <p className="mt-3 text-sm sm:text-base text-white/75 leading-relaxed max-w-xl">
                    {item.description}
                  </p>
                )}

                {/* Actions */}

                <div className="flex flex-wrap items-center gap-2 mt-5">
                  {restaurant.phone && (
                    <a
                      href={`tel:${restaurant.phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition"
                    >
                      <Phone size={16} />
                      Call
                    </a>
                  )}

                  {restaurant.address && (
                    <button
                      type="button"
                      onClick={() => setShowInfo(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-sm font-semibold hover:bg-black/60 transition"
                    >
                      <MapPin size={16} />
                      Location
                    </button>
                  )}
                </div>
              </div>

              {/* Swipe hint */}

              {index === 0 && items.length > 1 && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={scrollToNext}
                    className="flex flex-col items-center gap-1 text-white/60"
                  >
                    <span className="text-[10px] uppercase tracking-widest">
                      Swipe
                    </span>

                    <ChevronDown size={20} className="animate-bounce" />
                  </button>
                </div>
              )}
            </div>

            {/* =========================================
                SHARE MESSAGE
            ========================================== */}

            {shareMessage && (
              <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40">
                <div className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium shadow-xl">
                  {shareMessage}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* =========================================
          END SCREEN
      ========================================== */}

      <section
        ref={endScreenRef}
        data-type="end"
        className="relative h-[100dvh] w-full snap-start flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(
            135deg,
            ${primaryColor},
            ${secondaryColor}
          )`,
        }}
      >
        <div className="absolute inset-0 bg-black/20" />

        <div className="relative z-10 text-center px-6 max-w-md">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white/20 shadow-2xl"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-3xl font-bold border-4 border-white/20 shadow-2xl"
              style={{
                backgroundColor: primaryColor,
              }}
            >
              {restaurant.name?.charAt(0)?.toUpperCase()}
            </div>
          )}

          <h2 className="text-3xl sm:text-4xl font-bold mt-6">
            {restaurant.name}
          </h2>

          <p className="text-white/70 mt-3">
            You've reached the end of the menu.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <button
              type="button"
              onClick={() => {
                const firstSection = sectionRefs.current[items[0]?.id];

                firstSection?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
              className="px-5 py-3 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition"
            >
              View Menu Again
            </button>

            <button
              type="button"
              onClick={shareMenu}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black/30 border border-white/20 font-semibold hover:bg-black/50 transition"
            >
              <Share2 size={17} />
              Share Menu
            </button>
          </div>

          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              className="inline-flex items-center gap-2 mt-5 text-sm text-white/70 hover:text-white transition"
            >
              <Phone size={15} />
              {restaurant.phone}
            </a>
          )}
        </div>
      </section>

      {/* =========================================
          RESTAURANT INFO MODAL
      ========================================== */}

      {showInfo && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShowInfo(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full sm:max-w-md bg-white text-black rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                  Restaurant
                </p>

                <h3 className="text-2xl font-bold mt-1">{restaurant.name}</h3>
              </div>

              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <XIcon />
              </button>
            </div>

            {restaurant.description && (
              <p className="text-gray-500 text-sm leading-relaxed mt-5">
                {restaurant.description}
              </p>
            )}

            {/* PDF Menu Button */}
            {restaurant.pdf_menu_url && (
              <div className="mt-5">
                <a
                  href={restaurant.pdf_menu_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-black text-sm font-semibold transition"
                >
                  <FileText size={16} />
                  View PDF Menu
                </a>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {restaurant.address && (
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl">
                  <div className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center shrink-0">
                    <MapPin size={17} />
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Address</p>

                    <p className="text-sm font-medium mt-1">
                      {restaurant.address}
                    </p>
                  </div>
                </div>
              )}

              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition"
                >
                  <div className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center shrink-0">
                    <Phone size={17} />
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Phone</p>

                    <p className="text-sm font-medium mt-1">
                      {restaurant.phone}
                    </p>
                  </div>
                </a>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl font-semibold"
                >
                  <Phone size={17} />
                  Call
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="px-5 py-3 border rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================
// SMALL CLOSE ICON
// =========================================

function XIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

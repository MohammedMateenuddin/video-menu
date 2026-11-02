import { useEffect, useRef, useState, useCallback } from "react";
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
  Loader2,
} from "lucide-react";

// Instagram icon SVG — not available in this version of lucide-react
function InstagramIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

import { supabase } from "../../lib/supabase";

// Debounce for scrolling settle — avoids starting/aborting video decoding during fast swipes on iPhone
const SCROLL_SETTLE_MS = 80;

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

  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  const [isEndScreen, setIsEndScreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const [introPlaying, setIntroPlaying] = useState(false);
  const [introFading, setIntroFading] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);

  // Tracks which video is actually playing and decoded to avoid black screen: { [itemId]: true }
  const [playingMap, setPlayingMap] = useState({});
  // Tracks buffering state per video: { [itemId]: true }
  const [bufferingMap, setBufferingMap] = useState({});

  const videoRefs = useRef({});
  const sectionRefs = useRef({});
  const progressBarRef = useRef(null);
  const endScreenRef = useRef(null);
  const bgMusicRef = useRef(null);
  const introVideoRef = useRef(null);

  // Prevents dish videos from playing while welcome screen or intro video is active
  const isMenuInteractiveRef = useRef(false);

  // Scroll settle timer ref (prevents iOS video decoder deadlocks during fast swipes)
  const scrollSettleTimeoutRef = useRef(null);

  // Direct ref to activeIndex for callbacks without re-binding
  const activeIndexRef = useRef(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

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

      setShowWelcomeScreen(true);
      isMenuInteractiveRef.current = false;

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
  // REFS MANAGEMENT
  // =========================================

  function setVideoRef(id, element) {
    if (element) {
      videoRefs.current[id] = element;
    } else {
      delete videoRefs.current[id];
    }
  }

  function setSectionRef(id, element) {
    if (element) {
      sectionRefs.current[id] = element;
    } else {
      delete sectionRefs.current[id];
    }
  }

  // =========================================
  // SAFE PLAY & PAUSE (CRITICAL FOR iOS SAFARI)
  // =========================================

  /**
   * Safely plays an HTML5 video on iOS Safari without triggering AbortError
   */
  function safePlay(video) {
    if (!video) return;
    video.muted = true; // Audio comes from bgMusicRef to prevent iOS session ducking

    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        video._playPromise = playPromise;
        playPromise
          .then(() => {
            video._playPromise = null;
            setPaused(false);
          })
          .catch((err) => {
            video._playPromise = null;
            // Ignore abort error caused by normal swipe pause
            if (err.name !== "AbortError") {
              setPaused(true);
            }
          });
      }
    } catch (err) {
      setPaused(true);
    }
  }

  /**
   * Safely pauses an HTML5 video, waiting for any pending playPromise to resolve first
   */
  function safePause(video) {
    if (!video) return;
    if (video._playPromise) {
      video._playPromise
        .then(() => {
          video.pause();
        })
        .catch(() => {
          video.pause();
        });
    } else {
      video.pause();
    }
  }

  // =========================================
  // PLAY / PAUSE TOGGLE
  // =========================================

  function togglePlay(id) {
    const video = videoRefs.current[id];
    if (!video) return;

    if (video.paused) {
      safePlay(video);
      setPaused(false);
    } else {
      safePause(video);
      setPaused(true);
    }
  }

  // =========================================
  // HARDWARE PROGRESS BAR (ZERO REACT RE-RENDERS)
  // =========================================

  /**
   * Directly updates DOM transform on GPU compositor.
   * Does NOT trigger React component re-renders!
   * This guarantees 60fps scrolling on iPhone while video plays.
   */
  function handleVideoTimeUpdate(event, index) {
    if (index !== activeIndexRef.current) return;

    const video = event.currentTarget;
    if (!video.duration || !Number.isFinite(video.duration)) return;

    const progressRatio = Math.min(Math.max(video.currentTime / video.duration, 0), 1);
    if (progressBarRef.current) {
      progressBarRef.current.style.transform = `scaleX(${progressRatio})`;
    }
  }

  function handleVideoWaiting(itemId) {
    setBufferingMap((prev) => ({ ...prev, [itemId]: true }));
  }

  function handleVideoPlaying(itemId) {
    setBufferingMap((prev) => ({ ...prev, [itemId]: false }));
    setPlayingMap((prev) => ({ ...prev, [itemId]: true }));
  }

  function handleVideoEnded(index) {
    if (index !== activeIndexRef.current) return;
    if (progressBarRef.current) {
      progressBarRef.current.style.transform = "scaleX(1)";
    }
    setPaused(true);
  }

  // =========================================
  // MUTE TOGGLE
  // =========================================

  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);

    if (bgMusicRef.current) {
      bgMusicRef.current.muted = nextMuted;
      if (!nextMuted) {
        bgMusicRef.current.play().catch(() => {});
      }
    }
  }

  // =========================================
  // ACTIVATE SLIDE (SETTLED SCROLL LOGIC)
  // =========================================

  const activateSlide = useCallback((index) => {
    if (!items.length) return;

    const activeItem = items[index];
    if (!activeItem) return;

    setActiveIndex(index);
    setIsEndScreen(false);
    setPaused(false);

    // Reset progress bar transform
    if (progressBarRef.current) {
      progressBarRef.current.style.transform = "scaleX(0)";
    }

    // 1. Safely pause all non-active videos
    items.forEach((item, i) => {
      if (i !== index) {
        const otherVideo = videoRefs.current[item.id];
        if (otherVideo) {
          safePause(otherVideo);
        }
      }
    });

    // 2. Play active video if interactive
    if (isMenuInteractiveRef.current) {
      const activeVideo = videoRefs.current[activeItem.id];
      if (activeVideo) {
        if (!activeVideo.src || !activeVideo.src.includes(activeItem.video_url)) {
          activeVideo.src = activeItem.video_url;
        }
        safePlay(activeVideo);
      }
    }

    // 3. Preload the next 1 video metadata for instant swipe transition
    const nextItem = items[index + 1];
    if (nextItem && nextItem.video_url) {
      const nextVideo = videoRefs.current[nextItem.id];
      if (nextVideo && (!nextVideo.src || !nextVideo.src.includes(nextItem.video_url))) {
        nextVideo.src = nextItem.video_url;
        nextVideo.preload = "metadata";
      }
    }
  }, [items]);

  // =========================================
  // INTERSECTION OBSERVER
  // =========================================

  useEffect(() => {
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          // End Screen
          if (entry.target.dataset.type === "end") {
            items.forEach((it) => {
              const v = videoRefs.current[it.id];
              if (v) safePause(v);
            });
            setIsEndScreen(true);
            setPaused(true);
            return;
          }

          // Menu Item
          const index = Number(entry.target.dataset.index);
          if (!Number.isFinite(index)) return;

          // Debounce activation slightly so rapid swipes don't stall iOS media engine
          if (scrollSettleTimeoutRef.current) {
            clearTimeout(scrollSettleTimeoutRef.current);
          }

          scrollSettleTimeoutRef.current = setTimeout(() => {
            activateSlide(index);
          }, SCROLL_SETTLE_MS);
        });
      },
      {
        threshold: 0.55,
      },
    );

    Object.values(sectionRefs.current).forEach((section) => {
      if (section) observer.observe(section);
    });

    if (endScreenRef.current) {
      observer.observe(endScreenRef.current);
    }

    return () => {
      observer.disconnect();
      if (scrollSettleTimeoutRef.current) {
        clearTimeout(scrollSettleTimeoutRef.current);
      }
    };
  }, [items, activateSlide]);

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
        setTimeout(() => setShareMessage(""), 2000);
      }
    } catch (error) {
      console.log("Share cancelled:", error);
    }
  }

  // =========================================
  // SCROLL TO NEXT
  // =========================================

  function scrollToNext() {
    const nextIndex = activeIndex + 1;
    if (nextIndex >= items.length) {
      endScreenRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const nextItem = items[nextIndex];
    sectionRefs.current[nextItem?.id]?.scrollIntoView({ behavior: "smooth" });
  }

  const primaryColor = restaurant?.primary_color || "#111111";
  const secondaryColor = restaurant?.secondary_color || "#333333";

  const currentItem = items[activeIndex];
  const currentCategory =
    currentItem?.categories?.name || currentItem?.category_name || "";

  const categoriesList = items.reduce((acc, item) => {
    const catName = item.categories?.name || item.category_name;
    const catId = item.category_id || item.categories?.id;
    if (catName && catId && !acc.find((c) => c.id === catId)) {
      acc.push({ id: catId, name: catName, firstItemId: item.id });
    }
    return acc;
  }, []);

  // =========================================
  // LOADING & ERROR SCREENS
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

  if (error || !restaurant) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-6">
            <UtensilsCrossed size={28} className="text-white/60" />
          </div>
          <h1 className="text-2xl font-bold">Menu unavailable</h1>
          <p className="text-white/50 mt-3">{error || "We couldn't find this restaurant."}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="min-h-[100dvh] text-white flex items-center justify-center px-6"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
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
              style={{ backgroundColor: primaryColor }}
            >
              {restaurant.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold">{restaurant.name}</h1>
          <p className="text-white/70 mt-3">The menu is currently being prepared. Please check back soon.</p>
        </div>
      </div>
    );
  }

  // =========================================
  // MAIN COMPONENT RENDER
  // =========================================

  return (
    <div
      className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory bg-black text-white"
      style={{
        backgroundColor: "#000000",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
      }}
    >
      {/* Background Music */}
      {restaurant.background_music_url && (
        <audio
          ref={bgMusicRef}
          src={restaurant.background_music_url}
          loop
          preload="auto"
          onEnded={(e) => {
            e.target.currentTime = 0;
            e.target.play().catch(console.error);
          }}
        />
      )}

      {/* Welcome Screen */}
      {showWelcomeScreen && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black text-white p-6">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-24 h-24 rounded-full object-cover mb-6 border-4 border-white/20"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mb-6 flex items-center justify-center text-3xl font-bold border-4 border-white/20 bg-white/10">
              {restaurant.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold mb-2">{restaurant.name}</h1>
          <p className="text-white/70 text-center mb-10 max-w-sm">
            Experience our visual menu. Turn your sound on for the best experience.
          </p>
          <button
            onClick={() => {
              setMuted(false);

              if (restaurant.intro_video_url) {
                setIntroPlaying(true);
              }

              setShowWelcomeScreen(false);

              if (restaurant.intro_video_url) {
                if (introVideoRef.current) {
                  introVideoRef.current.muted = false;
                  introVideoRef.current.play().catch(console.error);
                }
                // Preload first video
                const firstItem = items[0];
                if (firstItem && firstItem.video_url) {
                  const video = videoRefs.current[firstItem.id];
                  if (video) {
                    video.src = firstItem.video_url;
                    video.preload = "auto";
                  }
                }
              } else {
                isMenuInteractiveRef.current = true;
                const activeItem = items[0];
                if (activeItem && activeItem.video_url) {
                  const video = videoRefs.current[activeItem.id];
                  if (video) {
                    video.src = activeItem.video_url;
                    video.preload = "auto";
                    safePlay(video);
                  }
                }

                if (bgMusicRef.current) {
                  bgMusicRef.current.muted = false;
                  bgMusicRef.current.play().catch(console.error);
                }
              }
            }}
            className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-[0_0_40px_rgba(255,255,255,0.3)] animate-pulse hover:animate-none transition"
          >
            Enter Menu
          </button>
        </div>
      )}

      {/* Intro Video Overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black flex items-center justify-center ${
          introFading
            ? "opacity-0 scale-110 pointer-events-none transition-all duration-1000 ease-[cubic-bezier(0.87,0,0.13,1)]"
            : introPlaying
              ? "opacity-100 scale-100"
              : "opacity-0 pointer-events-none"
        }`}
        style={{
          visibility: introPlaying || introFading ? "visible" : "hidden",
        }}
      >
        <video
          ref={introVideoRef}
          src={restaurant.intro_video_url}
          autoPlay
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onEnded={() => {
            setIntroFading(true);
            isMenuInteractiveRef.current = true;

            const activeItem = items[activeIndexRef.current];
            if (activeItem && activeItem.video_url) {
              const video = videoRefs.current[activeItem.id];
              if (video) {
                if (!video.src) video.src = activeItem.video_url;
                safePlay(video);
              }
            }

            if (bgMusicRef.current) {
              bgMusicRef.current.muted = false;
              bgMusicRef.current.play().catch(console.error);
            }

            setTimeout(() => {
              setIntroPlaying(false);
              setIntroFading(false);
            }, 1000);
          }}
          className="w-full h-full object-cover"
        />

        <button
          onClick={() => {
            if (introVideoRef.current) {
              introVideoRef.current.pause();
              introVideoRef.current.muted = true;
            }

            setIntroFading(true);
            isMenuInteractiveRef.current = true;

            const activeItem = items[activeIndexRef.current];
            if (activeItem && activeItem.video_url) {
              const video = videoRefs.current[activeItem.id];
              if (video) {
                if (!video.src) video.src = activeItem.video_url;
                safePlay(video);
              }
            }

            if (bgMusicRef.current) {
              bgMusicRef.current.muted = false;
              bgMusicRef.current.play().catch(console.error);
            }

            setTimeout(() => {
              setIntroPlaying(false);
              setIntroFading(false);
            }, 1000);
          }}
          className="absolute bottom-10 right-6 px-4 py-2 bg-white/20 backdrop-blur-md text-white rounded-full text-sm font-medium border border-white/20 z-10"
        >
          Skip Intro
        </button>
      </div>

      {/* =========================================
          FEED OF DISH CARDS
      ========================================== */}

      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const hasVideo = Boolean(item.video_url);
        const hasImage = Boolean(item.image_url);
        const categoryName = item?.categories?.name || item?.category_name || "";

        // Instant visual frame: If image_url exists, use it; otherwise use video poster frame (#t=0.001)
        const posterSrc = item.image_url || (item.video_url ? `${item.video_url}#t=0.001` : null);

        const isVideoReady = playingMap[item.id];
        const isBuffering = bufferingMap[item.id] && isActive;

        return (
          <section
            key={item.id}
            ref={(element) => setSectionRef(item.id, element)}
            data-index={index}
            data-type="item"
            className="relative h-[100dvh] w-full snap-start overflow-hidden bg-black"
          >
            {/* =========================================
                BACKGROUND MEDIA LAYER
            ========================================== */}

            {/* Layer 1: Instant Poster (ALWAYS rendered - Zero black screen, instant 60fps frame) */}
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={item.name}
                loading={index <= 1 ? "eager" : "lazy"}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                }}
              >
                <UtensilsCrossed size={70} className="text-white/20" />
              </div>
            )}

            {/* Layer 2: Video Player (Permanently mounted, fades in smoothly when ready) */}
            {hasVideo && (
              <video
                ref={(element) => setVideoRef(item.id, element)}
                muted
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                disablePictureInPicture
                disableRemotePlayback
                loop
                preload={isActive ? "auto" : "none"}
                onTimeUpdate={(event) => handleVideoTimeUpdate(event, index)}
                onEnded={() => handleVideoEnded(index)}
                onClick={() => togglePlay(item.id)}
                onWaiting={() => handleVideoWaiting(item.id)}
                onPlaying={() => handleVideoPlaying(item.id)}
                onCanPlay={() => handleVideoPlaying(item.id)}
                className={`absolute inset-0 w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${
                  isVideoReady ? "opacity-100" : "opacity-0"
                }`}
              />
            )}

            {/* Layer 3: Buffering Spinner (Appears gracefully over poster on slow networks) */}
            {isBuffering && (
              <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              </div>
            )}

            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

            {/* =========================================
                TOP HEADER
            ========================================== */}

            <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
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
                      style={{ backgroundColor: primaryColor }}
                    >
                      {restaurant.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-semibold text-sm sm:text-base truncate max-w-[190px] sm:max-w-xs">
                      {restaurant.name}
                    </p>
                    {categoryName && (
                      <p className="text-xs text-white/60 mt-0.5">{categoryName}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {restaurant.pdf_menu_url && (
                    <div className="relative">
                      <a
                        href={restaurant.pdf_menu_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition relative z-10"
                        title="View PDF Menu"
                      >
                        <FileText size={18} />
                      </a>
                      {index === 0 && (
                        <div className="absolute top-[120%] right-0 whitespace-nowrap bg-white text-black px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl animate-bounce pointer-events-none origin-top-right before:content-[''] before:absolute before:bottom-[99%] before:right-4 before:border-4 before:border-transparent before:border-b-white">
                          View full menu
                        </div>
                      )}
                    </div>
                  )}

                  {restaurant.instagram_url && (
                    <a
                      href={restaurant.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Instagram"
                      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition"
                    >
                      <InstagramIcon size={18} />
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

              {/* Progress Bar (Updated via hardware transform ref, zero React re-renders) */}
              <div className="mt-4 w-full h-0.5 rounded-full bg-white/25 overflow-hidden">
                <div
                  ref={isActive ? progressBarRef : null}
                  className="h-full rounded-full bg-white origin-left"
                  style={{
                    transform: "scaleX(0)",
                    transition: "transform 150ms linear",
                  }}
                />
              </div>

              {/* Categories Navigation */}
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

            {/* Play/Pause Overlay Icon */}
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
                {paused ? <Play size={27} fill="white" /> : <Pause size={25} fill="white" />}
              </button>
            )}

            {/* Dish Information */}
            <div
              className="absolute left-0 right-0 bottom-0 z-20 px-5 sm:px-7 pb-16 sm:pb-20"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom, 4rem), 4rem)" }}
            >
              <div className="max-w-2xl">
                {categoryName && (
                  <div className="mb-3">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md border border-white/10"
                      style={{ backgroundColor: `${primaryColor}CC` }}
                    >
                      {categoryName}
                    </span>
                  </div>
                )}

                {item.is_bestseller && (
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1.5 bg-yellow-400 text-black px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      <Star size={13} fill="currentColor" />
                      BESTSELLER
                    </span>
                  </div>
                )}

                <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold leading-tight drop-shadow-lg">
                    {item.name}
                  </h1>
                  <span className="text-xl sm:text-2xl font-bold drop-shadow-lg text-white/90 pb-0.5">
                    ₹{Number(item.price || 0).toFixed(0)}
                  </span>
                </div>

                {item.description && (
                  <p className="mt-2 text-xs sm:text-sm text-white/75 leading-relaxed max-w-xl">
                    {item.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {restaurant.phone && (
                    <a
                      href={`tel:${restaurant.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white text-black text-xs sm:text-sm font-semibold hover:bg-white/90 transition"
                    >
                      <Phone size={14} />
                      Call
                    </a>
                  )}

                  {restaurant.address && (
                    <button
                      type="button"
                      onClick={() => setShowInfo(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-xs sm:text-sm font-semibold hover:bg-black/60 transition"
                    >
                      <MapPin size={14} />
                      Location
                    </button>
                  )}
                </div>
              </div>

              {index === 0 && items.length > 1 && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={scrollToNext}
                    className="flex flex-col items-center gap-1 text-white/60"
                  >
                    <span className="text-[10px] uppercase tracking-widest">Swipe</span>
                    <ChevronDown size={20} className="animate-bounce" />
                  </button>
                </div>
              )}
            </div>

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
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
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
              style={{ backgroundColor: primaryColor }}
            >
              {restaurant.name?.charAt(0)?.toUpperCase()}
            </div>
          )}

          <h2 className="text-3xl sm:text-4xl font-bold mt-6">{restaurant.name}</h2>
          <p className="text-white/70 mt-3">You've reached the end of the menu.</p>

          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <button
              type="button"
              onClick={() => {
                sectionRefs.current[items[0]?.id]?.scrollIntoView({ behavior: "smooth" });
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
          INFO MODAL
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
                <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Restaurant</p>
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
                    <p className="text-sm font-medium mt-1">{restaurant.address}</p>
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
                    <p className="text-sm font-medium mt-1">{restaurant.phone}</p>
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

import { motion } from "motion/react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { GiArtificialHive } from "react-icons/gi";
import { FaArrowRight } from "react-icons/fa6";

import dashboard from "../../assets/image.png";
import LoginModel from "./components/LoginModel";

import { FiImage, FiSearch, FiCalendar, FiShield } from "react-icons/fi";
import type { User } from "../../types/user";

interface HomeProps {
  setUser: Dispatch<SetStateAction<User | null>>;
}

const Home = ({ setUser }: HomeProps) => {
  const [showLogin, setShowLogin] = useState(false);

  const features = [
    {
      icon: <FiImage />,
      title: "Personal Memory Library",
      desc: "Bring your photos, videos, documents and important moments together in one searchable personal space.",
    },
    {
      icon: <FiSearch />,
      title: "Ask Your Memories",
      desc: "Find what you're looking for using natural language. Search people, places, events and details from your memories.",
    },
    {
      icon: <FiCalendar />,
      title: "Event Intelligence",
      desc: "Connect moments across dates, people and places. Organize memories around meaningful events and experiences.",
    },
    {
      icon: <FiShield />,
      title: "AI With Your Control",
      desc: "Keep your memories private, review AI-generated insights and stay in control of actions taken on your behalf.",
    },
  ];

  return (
    <div className="bg-white text-[#0A0A0A] font-sans min-h-screen overflow-x-hidden">
      {/* Navbar */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 h-[52px] flex items-center justify-between px-5 bg-white/70 backdrop-blur-xl border-b border-black/5"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0A0A0A] flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
            <GiArtificialHive size={15} color="white" />
          </div>

          <span className="font-extrabold text-base tracking-tight text-[#0A0A0A]">
            Memora AI
          </span>
        </div>

        <motion.button
          onClick={() => setShowLogin(true)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="bg-[#0A0A0A]/80 backdrop-blur-2xl text-white font-semibold border border-white/10 rounded-md px-3 py-1.5 text-xs cursor-pointer transition-all hover:border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.25)] flex items-center gap-2"
        >
          Log In <FaArrowRight />
        </motion.button>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-14 overflow-hidden bg-[#F8F9FA]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-black/[0.04] blur-[90px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="inline-flex items-center px-3 py-1.5 rounded-full border border-black/15 bg-black/5 text-black/70 text-xs font-medium mb-4"
          >
            Your Personal AI Memory Assistant
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-4 text-[#0A0A0A] [text-shadow:0_4px_24px_rgba(0,0,0,0.12)]"
          >
            Your Life.
            <span className="text-black/30"> Your Memories. </span>
            Your AI.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-black/45 text-sm leading-relaxed max-w-md mx-auto mb-6 [text-shadow:0_2px_10px_rgba(0,0,0,0.06)]"
          >
            Memora AI brings your photos, videos, documents and life experiences
            together. Find forgotten moments, connect memories and rediscover
            the details that matter — all with the power of AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28 }}
          >
            <motion.button
              onClick={() => setShowLogin(true)}
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 36px rgba(0,0,0,0.18)",
              }}
              whileTap={{ scale: 0.97 }}
              className="relative gap-2 overflow-hidden bg-[#0A0A0A]/80 backdrop-blur-2xl text-white font-bold px-5 py-2.5 rounded-lg text-xs cursor-pointer border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all hover:border-white/20"
            >
              <span className="flex items-center justify-center gap-2">
                Get Started For Free <FaArrowRight />
              </span>

              <span className="absolute inset-0 bg-gradient-to-br from-white/[0.1] via-transparent to-transparent pointer-events-none rounded-lg" />
            </motion.button>
          </motion.div>
        </div>

        {/* Product Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -10, scale: 1.02 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 rounded-lg overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.06)] max-w-2xl mx-auto"
        >
          <img
            src={dashboard}
            alt="Memora AI personal memory dashboard preview"
            className="w-full h-auto object-cover block"
          />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-[#F8F9FA]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-black/15 bg-black/5 text-black/70 text-xs font-medium mb-4">
              Memories Made Intelligent
            </div>

            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[#0A0A0A] [text-shadow:0_4px_20px_rgba(0,0,0,0.1)]">
              More Than Just
              <span className="block text-black/30">Storing Your Memories</span>
            </h2>

            <p className="text-black/40 text-sm max-w-2xl mx-auto mt-4 leading-relaxed">
              Your life is full of moments, information and experiences. Memora
              AI aims to make them meaningful and accessible through intelligent
              search, connected memories and AI-powered assistance.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group relative overflow-hidden bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)] hover:border-white/20 transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />

                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-white text-lg mb-4 shadow-inner">
                    {feature.icon}
                  </div>

                  <h2 className="text-base font-bold mb-2 text-white">
                    {feature.title}
                  </h2>

                  <p className="text-white/45 text-xs leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Login Popup */}
      {showLogin && (
        <LoginModel onClose={() => setShowLogin(false)} setUser={setUser} />
      )}

      {/* Footer */}
      <footer className="border-t border-black/7 py-6 text-center bg-white">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-md bg-[#0A0A0A] flex items-center justify-center">
            <GiArtificialHive size={11} color="white" />
          </div>

          <span className="font-bold text-xs text-[#0A0A0A]/70">Memora AI</span>
        </div>

        <div className="text-black/50 text-xs">
          © {new Date().getFullYear()} Memora AI · Your Life. Your Memories.
          Your AI.
        </div>
      </footer>
    </div>
  );
};

export default Home;

import { useState, useEffect, type ReactNode } from "react"; 
import { Link } from "@tanstack/react-router";
import { Zap, Users, BarChart2 } from "lucide-react";
import logoLight from "@/Assets/LogoLight1.png";
import logoDark from "@/Assets/LogoDark.png";
import login3D from "@/Assets/Login.png";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="grid w-full max-w-[1440px] min-h-[580px] lg:min-h-[660px] my-auto bg-white rounded-[1.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden lg:grid-cols-[1.4fr_1fr] relative z-10">
        {/* LEFT SIDE: Promotional / Branding (Hidden on mobile) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#e0f8ee]/30 border-r border-slate-100 lg:flex px-8 py-8 xl:px-10">
        {/* Animated Background Effects */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse duration-[10000ms] pointer-events-none" />
        <div className="absolute top-[30%] -right-[20%] w-[600px] h-[600px] bg-teal-400/20 rounded-full blur-[100px] animate-pulse duration-[7000ms] delay-1000 pointer-events-none" />
        <div className="absolute -bottom-[20%] left-[10%] w-[900px] h-[900px] bg-[#00df81]/15 rounded-full blur-[150px] animate-pulse duration-[10000ms] delay-500 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Top bar with Logo */}
        <div className="relative z-10 flex flex-col justify-start">
          <Link to="/">
            <img src={logoLight} className="h-14 w-auto" alt="Whatsaap Logo" />
          </Link>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 flex w-full max-w-[420px] xl:max-w-[480px] flex-col justify-center gap-4 mt-0">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-50 backdrop-blur-sm px-4 py-1.5 mt-[10%] mb-4">
              <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                WhatsApp automation platform
              </span>
            </div>
            
            <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl">
              Automate Your <br />
              <span className="text-[#00df81]">WhatsApp </span> <br />
              Conversations<span className="text-[#00df81]">.</span>
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-sm font-medium">
              Connect, engage, and grow your business.
            </p>

            <div className="mt-8 flex flex-col gap-6 max-w-sm">
              {/* Feature 1 */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 shrink-0 bg-emerald-100/50 rounded-lg flex items-center justify-center">
                   <Zap className="size-5 text-[#00df81]" fill="#00df81" />
                </div>
                <div>
                  <h4 className="text-slate-900 font-bold text-[14px]">Quick Setup</h4>
                  <p className="text-slate-600 text-[13px] mt-0.5">Get started in minutes</p>
                </div>
              </div>
              
              {/* Feature 2 */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 shrink-0 bg-emerald-100/50 rounded-lg flex items-center justify-center">
                   <Users className="size-5 text-[#00df81]" fill="#00df81" />
                </div>
                <div>
                  <h4 className="text-slate-900 font-bold text-[14px]">Reach More</h4>
                  <p className="text-slate-600 text-[13px] mt-0.5">Connect with thousands</p>
                </div>
              </div>
              
              {/* Feature 3 */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 shrink-0 bg-emerald-100/50 rounded-lg flex items-center justify-center">
                   <BarChart2 className="size-5 text-[#00df81]" fill="#00df81" />
                </div>
                <div>
                  <h4 className="text-slate-900 font-bold text-[14px]">Track & Grow</h4>
                  <p className="text-slate-600 text-[13px] mt-0.5">Measure real results</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Graphic */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[60%] max-w-[500px] pointer-events-none z-0 xl:w-[55%] xl:right-8">
          <img src={login3D} alt="WhatsApp Automation 3D" className="w-full h-auto drop-shadow-2xl object-contain" />
        </div>

        {/* Bottom text */}
        <div className="relative z-10 flex justify-between items-end text-sm text-slate-500 mt-auto pb-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-0.5 bg-[#00df81]" />
            <span className="font-semibold tracking-[0.2em] text-[11px] uppercase opacity-80 text-emerald-800">
              Trusted by modern businesses
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Form Container */}
      <div className="relative flex flex-col justify-center bg-white h-full py-8 lg:py-6">
        {/* Subtle background abstract shape on right side */}
        <div className="absolute inset-y-0 left-0 w-72 bg-emerald-50/40 rounded-r-[100%] blur-[100px] pointer-events-none" />

        <div className="w-full max-w-[440px] mx-auto px-6 z-10 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-none border-none p-0 sm:p-0">
            <div className="mb-4 text-center flex flex-col items-center">
              <div className="flex items-center gap-2.5 mb-6 justify-center">
                <div className="h-[60px] w-[70px] flex items-center pt-4 justify-center overflow-hidden shrink-0 mix-blend-multiply">
                  <video src="/LogoIcon.mp4" autoPlay loop muted playsInline className="scale-[.9] min-w-[220px]" />
                </div>
                <img src={logoLight} className="h-14 w-auto dark:hidden block" alt="Whatsaap Logo" />
                <img src={logoDark} className="h-14 w-auto hidden dark:block" alt="Whatsaap Logo" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-500 font-medium">{subtitle}</p>
            </div>
            
            <div className="mt-4">{children}</div>
            
            {footer && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {footer}
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Right text */}
        {/* <div className="absolute bottom-6 left-0 right-0 text-center sm:text-right sm:left-auto sm:right-8 text-xs text-slate-400 font-medium flex items-center justify-center sm:justify-end gap-2">
          Built for modern businesses <span className="size-1.5 rounded-full bg-[#00df81] shadow-[0_0_8px_rgba(0,223,129,0.8)]"></span>
        </div> */}
      </div>
    </div>
    </div>
  );
}

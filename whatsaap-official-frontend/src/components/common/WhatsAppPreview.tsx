import { Check, CheckCheck, FileText, Image, Mic, MoreVertical, Paperclip, Phone, Play, Smile, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateAttachment } from "@/types";

/** Renders a realistic WhatsApp chat bubble preview for templates/campaigns. */
export function WhatsAppPreview({
  body,
  contactName = "Smart ItBox",
  className,
  variables = {},
  attachment,
  attachments,
  showReply = false,
  showInputBar = true,
  chatClassName,
}: {
  body: string;
  contactName?: string;
  className?: string;
  variables?: Record<string, string>;
  attachment?: TemplateAttachment | undefined;
  attachments?: TemplateAttachment[] | undefined;
  showReply?: boolean;
  showInputBar?: boolean;
  chatClassName?: string;
}) {
  const resolved = body.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => variables[key] ?? `{{${key}}}`);
  const files = attachments?.length ? attachments : attachment ? [attachment] : [];

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200/90 bg-[#efeae2] shadow-sm flex flex-col", className)}>
      {/* WhatsApp Header */}
      <div className="flex items-center justify-between border-b border-emerald-900/10 bg-[#075E54] px-3 py-2 text-white shadow-2xs shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-700/80 text-[11px] font-bold text-white ring-1 ring-white/30">
              {contactName.slice(0, 2).toUpperCase()}
            </span>
            <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-400 ring-1 ring-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white leading-tight">{contactName}</p>
            <p className="text-[10px] text-emerald-100/90 leading-tight">online</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-emerald-100">
          <Video className="size-3.5 opacity-80" />
          <Phone className="size-3.5 opacity-80" />
          <MoreVertical className="size-3.5 opacity-80" />
        </div>
      </div>

      {/* WhatsApp Chat Body */}
      <div className={cn("flex-1 p-2.5 space-y-2 overflow-y-auto min-h-[360px] max-h-[430px] bg-[#efeae2]/90", chatClassName)}>
        {/* Outgoing Broadcast Message Bubble */}
        <div className="ml-auto max-w-[88%] rounded-lg rounded-tr-none bg-[#D9FDD3] p-2 text-slate-900 shadow-2xs border border-emerald-200/60">
          {files.length > 0 && (
            <div className="mb-1.5 space-y-1">
              {files.map((file) => {
                const isImage = file.kind === "image";
                const isVideo = file.kind === "video";
                const AttachmentIcon = isImage ? Image : isVideo ? Play : FileText;
                return (
                  <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-md bg-white/95 p-1.5 shadow-2xs border border-emerald-100">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                      <AttachmentIcon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-slate-800">{file.name}</span>
                      <span className="block text-[9px] font-medium uppercase tracking-wider text-slate-500">{file.kind}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-900 font-sans">
            {resolved || "Your message preview will appear here."}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500 font-medium">
            <span>11:24</span>
            <CheckCheck className="size-3.5 text-[#53bdeb]" />
          </div>
        </div>

        {/* Optional Incoming Reply */}
        {showReply && (
          <div className="max-w-[70%] rounded-lg rounded-tl-none bg-white p-2 text-slate-900 shadow-2xs border border-slate-200/60">
            <p className="text-xs text-slate-800">Thanks for the update! 🙏</p>
            <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">
              <span>11:26</span>
              <Check className="size-3" />
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Input Footer */}
      {showInputBar && (
        <div className="border-t border-slate-200/80 bg-[#f0f2f5] px-2 py-1.5 flex items-center gap-1.5 shrink-0">
          <Smile className="size-4 text-slate-500 shrink-0" />
          <div className="flex-1 rounded-full bg-white px-3 py-1 text-[11px] text-slate-400 border border-slate-200/70 shadow-2xs">
            Type a message
          </div>
          <Paperclip className="size-3.5 text-slate-500 shrink-0" />
          <span className="flex size-6 items-center justify-center rounded-full bg-[#00a884] text-white shrink-0">
            <Mic className="size-3" />
          </span>
        </div>
      )}
    </div>
  );
}

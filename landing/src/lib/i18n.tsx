"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "vi" | "en";

const dict = {
  vi: {
    navProcess: "Quy trình",
    navAudience: "Đối tượng",
    navProduct: "Sản phẩm",
    navCta: "Bắt đầu",
    navSignIn: "Đăng nhập",
    eyebrow: "NIC · Deal-flow Matchmaker · có bằng chứng",
    heroTitle1: "Từ pitch deck",
    heroTitle2: "đến đúng cuộc họp.",
    heroLead:
      "Nền tảng AI cho National Innovation Center (NIC): phân tích hồ sơ startup, tìm đối tác phù hợp (doanh nghiệp · viện trường · quỹ), soạn intro cá nhân hóa và gợi ý lịch họp — AI gợi ý, NIC staff duyệt.",
    heroPrimary: "Tải deck của bạn",
    heroSecondary: "Xem cách hoạt động",
    trust: ["Startups", "Corporates", "Universities", "Funds", "NIC"],
    problemEyebrow: "Vấn đề",
    problemTitle: "Tìm đối tác không nên phụ thuộc vào may rủi.",
    problemBody:
      "Email lạnh, danh bạ cũ và tìm kiếm thủ công làm chậm cả startup lẫn quỹ. Nexora Flow chuẩn hóa hồ sơ, match có giải thích, rồi hỗ trợ giới thiệu đến cuộc họp — đúng đề Deal-flow Matchmaker của NIC.",
    processEyebrow: "Quy trình",
    processTitle: "Deck vào. Họp ra.",
    processHint: "Cuộn chuột để trải nghiệm",
    steps: [
      {
        n: "01",
        t: "Tải và Chuẩn hóa hồ sơ",
        d: "Tự động đọc pitch deck để trích xuất sản phẩm, công nghệ, thị trường, giai đoạn phát triển và nhu cầu hợp tác — phát hiện thông tin thiếu và gợi ý bổ sung.",
      },
      {
        n: "02",
        t: "Chấm điểm & Xếp hạng AI",
        d: "AI tự động đối chiếu hồ sơ với thư viện doanh nghiệp, trường đại học, viện nghiên cứu và quỹ đầu tư để chấm điểm, xếp hạng những kết nối phù hợp nhất.",
      },
      {
        n: "03",
        t: "Giải thích lý do đề xuất",
        d: "Giải thích chi tiết điểm phù hợp, lợi ích tiềm năng, đề xuất hình thức hợp tác (đầu tư, R&D, pilot, chuyển giao công nghệ) kèm bằng chứng từ hồ sơ.",
      },
      {
        n: "04",
        t: "Soạn email giới thiệu",
        d: "Trợ lý AI tự động soạn thư giới thiệu cá nhân hóa dựa trên nhu cầu và điểm phù hợp của từng cặp kết nối. Bạn toàn quyền xem trước, chỉnh sửa và duyệt.",
      },
      {
        n: "05",
        t: "Đồng bộ lịch & Đặt cuộc họp",
        d: "Đồng bộ lịch trống của hai bên, tự động đề xuất khung giờ, tạo phòng họp trực tuyến và theo dõi toàn bộ quá trình trao đổi cho đến khi chốt deal.",
      },
    ],
    audienceEyebrow: "Hai phía · một điểm số",
    audienceTitle: "Một điểm số. Hai phía đều có lợi.",
    audienceLead:
      "Match chỉ tốt khi tốt cho cả hai. Hồ sơ chuẩn hóa, thesis rõ ràng, điểm fit có bằng chứng — cùng một thang đo.",
    startupTag: "Startup",
    startupTitle: "Dừng cold outreach. Hãy để thesis tìm bạn.",
    startupItems: [
      "Một deck → hồ sơ chuẩn hóa, sẵn sàng match",
      "Gap check trước khi đối tác nhìn thấy",
      "Đối tác xếp hạng + lý do — không phải danh bạ",
      "Gợi ý deal type: đầu tư, pilot, R&D, tech transfer",
      "Alert khi partner mới khớp mandate",
    ],
    partnerTag: "Corporate · Lab · Fund",
    partnerTitle: "Deal-flow đúng thesis, có bằng chứng.",
    partnerItems: [
      "Định nghĩa thesis một lần: sector, stage, check, region",
      "Thư viện startup lọc theo tech & nhu cầu",
      "Fit score kèm evidence trích từ hồ sơ",
      "Express interest & theo dõi từng conversation",
      "Feedback sau mỗi intro → model match tốt hơn",
    ],
    productEyebrow: "Nền tảng",
    productTitle: "Không phải danh bạ. Matchmaker có giải thích.",
    features: [
      {
        t: "Match có giải thích",
        d: "Không chấm điểm hộp đen. Mỗi đề xuất đều hiển thị điểm số chi tiết, lý do, giá trị tiềm năng và những điểm cần xác minh.",
      },
      {
        t: "Email do bạn duyệt",
        d: "Lời chào được soạn thảo từ dữ liệu thực tế của hai bên. Xem trước, chỉnh sửa, phê duyệt — không tự động gửi.",
      },
      {
        t: "Đặt lịch tự động",
        d: "Đồng bộ lịch trống, đề xuất khung giờ phù hợp và gửi lời mời họp.",
      },
      {
        t: "Trợ lý AI hỗ trợ deal",
        d: "So sánh danh sách rút gọn, hỏi lý do match, gợi ý bước tiếp theo.",
      },
      {
        t: "Theo dõi toàn phễu",
        d: "Kết nối, tỷ lệ phản hồi, họp mặt, chốt deal — kèm vòng phản hồi giúp tinh chỉnh thuật toán match theo thời gian.",
      },
      {
        t: "Dữ liệu của bạn, quy tắc của bạn",
        d: "Chọn thông tin công khai, ai được xem hồ sơ và những tổ chức nào được phép kết nối.",
      },
    ],
    matchBadge: "Đã tìm thấy match",
    matchScore: "ĐIỂM FIT",
    matchStartup: "STARTUP",
    matchPartner: "ĐỐI TÁC",
    matchTags: ["Lĩnh vực khớp", "Giai đoạn Seed", "Đông Nam Á"],
    matchCta: "Soạn email giới thiệu",
    ctaEyebrow: "Truy cập sớm",
    ctaTitle: "Sẵn sàng dừng cold outreach?",
    ctaBody:
      "Tải deck hoặc định nghĩa thesis. Nhận shortlist có bằng chứng — intro chỉ gửi khi bạn duyệt.",
    ctaBtn: "Xin early access",
    footerLeft: "DEAL-FLOW MATCHMAKER · THỬ THÁCH TRUNG TÂM ĐỔI MỚI SÁNG TẠO QUỐC GIA",
    footerRight: "nexora-flow.cloud",
    themeLight: "Chế độ sáng",
    themeDark: "Chế độ tối",
    langLabel: "Ngôn ngữ",
  },
  en: {
    navProcess: "Process",
    navAudience: "Sides",
    navProduct: "Platform",
    navCta: "Join",
    navSignIn: "Sign in",
    eyebrow: "NIC · Deal-flow Matchmaker · evidence-bound",
    heroTitle1: "From pitch deck",
    heroTitle2: "to the right meeting.",
    heroLead:
      "An AI platform for the National Innovation Center (NIC): analyze startup profiles, match the best partners (corporates · universities · funds), draft personalized intros, and suggest meetings — AI proposes, NIC staff approve.",
    heroPrimary: "Upload your deck",
    heroSecondary: "Watch it work",
    trust: ["Startups", "Corporates", "Universities", "Funds", "NIC"],
    problemEyebrow: "Why we exist",
    problemTitle: "Finding partners shouldn’t depend on luck.",
    problemBody:
      "Cold emails and stale directories slow everyone down. Nexora Flow standardizes profiles, matches with explanations, then supports intros to meetings — built for the NIC Deal-flow Matchmaker brief.",
    processEyebrow: "The process",
    processTitle: "Deck in. Meeting out.",
    processHint: "Scroll to dive in",
    steps: [
      {
        n: "01",
        t: "Ingest & Standardize Profile",
        d: "Upload a pitch deck. AI extracts product, tech, market, stage, and collaboration needs — detecting gaps and suggesting completions.",
      },
      {
        n: "02",
        t: "Match & Rank the Network",
        d: "AI matches profiles against corporations, universities, labs, and funds, scoring and ranking the most suitable partners.",
      },
      {
        n: "03",
        t: "Explain the Match Reason",
        d: "Each recommendation details fit score, benefits, and best collaboration format (investment, pilot, R&D, tech transfer) with sources.",
      },
      {
        n: "04",
        t: "Draft Personalized Intros",
        d: "AI drafts custom introductions based on both sides' needs. You preview, edit, and approve before sending. Nothing goes out automatically.",
      },
      {
        n: "05",
        t: "Sync & Book the Meeting",
        d: "Synchronize calendars to find a slot, suggest timings, create a virtual meeting, and track the pipeline from hello to term sheet.",
      },
    ],
    audienceEyebrow: "Two sides, one score",
    audienceTitle: "One score. Built for both sides of the intro.",
    audienceLead:
      "A match only works if it works both ways. Standardized profiles, clear theses, evidence-bound fit — same scale, two directions.",
    startupTag: "Startup",
    startupTitle: "Stop cold outreach. Let the thesis find you.",
    startupItems: [
      "One deck → a complete, match-ready profile",
      "Gap check before partners ever see you",
      "Ranked partners with reasons — not a directory",
      "Deal-type hints: investment, pilot, R&D, tech transfer",
      "Alerts when a new matching partner joins",
    ],
    partnerTag: "Corporate · Lab · Fund",
    partnerTitle: "Deal flow that fits your mandate.",
    partnerItems: [
      "Define your thesis once: sector, stage, check, region",
      "Filtered startup library by tech & need",
      "Fit scores with evidence from the profiles",
      "Express interest and track every conversation",
      "Feedback after each intro sharpens the model",
    ],
    productEyebrow: "Platform",
    productTitle: "Not a directory. A matchmaker with receipts.",
    features: [
      {
        t: "Explainable matches",
        d: "No black-box rankings. Every suggestion shows its score broken down, the reasoning, the potential value — and the claims worth double-checking.",
      },
      {
        t: "Intros that sound like you",
        d: "Outreach drafted from real profile data. Preview, edit, approve — nothing sends itself.",
      },
      {
        t: "Scheduling that happens",
        d: "Shared availability, suggested slots, invite sent.",
      },
      {
        t: "A copilot for every deal",
        d: "Compare shortlists, ask why, get the next step.",
      },
      {
        t: "Full-funnel visibility",
        d: "Connections, response rates, meetings, closed deals — with feedback loops that sharpen the matching over time.",
      },
      {
        t: "Your data, your rules",
        d: "Choose what's public, who sees your profile, and which organizations may reach out.",
      },
    ],
    matchBadge: "Match found",
    matchScore: "FIT SCORE",
    matchStartup: "STARTUP",
    matchPartner: "PARTNER",
    matchTags: ["Sector fit", "Seed stage", "SEA"],
    matchCta: "Draft intro email",
    ctaEyebrow: "Early access",
    ctaTitle: "Ready to stop cold outreach?",
    ctaBody:
      "Upload a deck or define a thesis. Get an evidence-bound shortlist — intros only leave when you approve.",
    ctaBtn: "Request early access",
    footerLeft: "DEAL-FLOW MATCHMAKER · NATIONAL INNOVATION CENTER CHALLENGE",
    footerRight: "nexora-flow.cloud",
    themeLight: "Light mode",
    themeDark: "Dark mode",
    langLabel: "Language",
  },
} as const;

export type Dict = (typeof dict)["vi"];

type I18nCtx = {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");

  useEffect(() => {
    const saved = window.localStorage.getItem("nf-lang") as Lang | null;
    if (saved === "vi" || saved === "en") {
      // Use setTimeout to avoid synchronous setState lint warning
      const t = setTimeout(() => setLangState(saved), 0);
      return () => clearTimeout(t);
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("nf-lang", l);
    document.documentElement.lang = l;
    // Motion manifesto re-queries chars after React rewrites the DOM
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nf-lang-change", { detail: { lang: l } }),
      );
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "vi" ? "en" : "vi");
  }, [lang, setLang]);

  const value = useMemo(
    () => ({ lang, t: dict[lang] as Dict, setLang, toggleLang }),
    [lang, setLang, toggleLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

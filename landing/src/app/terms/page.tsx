import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description:
    'Điều khoản sử dụng Nexora Flow — quy định về tài khoản, nội dung tải lên, các vòng kết nối và giới hạn trách nhiệm.',
  alternates: { canonical: 'https://nexora-flow.cloud/terms' },
  openGraph: {
    title: 'Điều khoản sử dụng · Nexora Flow',
    url: 'https://nexora-flow.cloud/terms',
  },
  robots: { index: true, follow: true },
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-2 text-base font-semibold text-foreground">{children}</h2>
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="inline-flex items-center gap-2">
        <Logo size={28} />
      </Link>
      <h1 className="mt-8 font-heading text-3xl font-semibold tracking-tight">
        Điều khoản sử dụng <span className="text-muted-foreground">· Terms of Use</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cập nhật: 19/07/2026 · Nexora Flow · nexora-flow.cloud
      </p>
      <div className="mt-8 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <H2>1. Dịch vụ</H2>
        <p>
          Nexora Flow cung cấp công cụ phần mềm cho việc xây dựng hồ sơ startup, tiếp
          nhận chương trình (intake), sàng lọc có AI hỗ trợ và so khớp đối tác. Kết quả
          AI chỉ là hỗ trợ ra quyết định; người vận hành (nhân sự NIC / chủ workspace)
          phê duyệt quyết định cuối cùng.
        </p>

        <H2>2. Tài khoản</H2>
        <p>
          Tài khoản Startup Portal và tài khoản Intake workspace là hai loại tách biệt —
          một email chỉ thuộc một phía và không thể dùng chéo. Bạn chịu trách nhiệm bảo
          mật thông tin đăng nhập của mình. Tài khoản mới có thể cần quản trị viên phê
          duyệt trước khi kích hoạt.
        </p>

        <H2>3. Nội dung bạn tải lên</H2>
        <p>
          Bạn giữ quyền sở hữu hồ sơ, tài liệu và video của mình, đồng thời cấp cho
          Nexora Flow quyền lưu trữ, xử lý (bao gồm xử lý bằng AI) và hiển thị nội dung
          đó cho đúng các tổ chức mà bạn yêu cầu kết nối hoặc đồng ý so khớp — theo{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Chính sách bảo mật
          </Link>
          . Bạn cam kết cung cấp thông tin trung thực và có quyền hợp pháp với nội dung
          tải lên.
        </p>

        <H2>4. Các vòng kết nối</H2>
        <p>
          Khi tham gia quy trình kết nối (kiểm duyệt hồ sơ, phỏng vấn video, câu hỏi
          thẩm định), bạn đồng ý rằng nội dung bạn nộp trong từng vòng được chia sẻ cho
          tổ chức thẩm định tương ứng. Quyết định duyệt/loại thuộc về tổ chức đó; Nexora
          Flow không bảo đảm kết quả kết nối hay bất kỳ cam kết đầu tư nào.
        </p>

        <H2>5. Hành vi bị cấm</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tải lên mã độc, nội dung vi phạm pháp luật hoặc xâm phạm quyền bên thứ ba.</li>
          <li>Mạo danh tổ chức/cá nhân khác, cung cấp hồ sơ gian dối.</li>
          <li>Truy cập trái phép tài khoản, dữ liệu của người dùng khác.</li>
          <li>Thu thập dữ liệu tự động (scraping) ngoài phạm vi API được cấp.</li>
        </ul>

        <H2>6. Giới hạn trách nhiệm</H2>
        <p>
          Dịch vụ được cung cấp &ldquo;nguyên trạng&rdquo; trong khuôn khổ sản phẩm
          demo/hệ sinh thái đổi mới sáng tạo. Trong phạm vi pháp luật cho phép, Nexora
          Flow không chịu trách nhiệm cho thiệt hại gián tiếp phát sinh từ việc sử dụng
          nền tảng hoặc từ quyết định của các tổ chức thẩm định.
        </p>

        <H2>7. Đăng nhập Google</H2>
        <p>
          Google OAuth (nếu dùng) do Google cung cấp theo điều khoản của Google. Nexora
          Flow chỉ nhận thông tin hồ sơ cơ bản sau khi bạn đồng ý trên tên miền của
          Google.
        </p>

        <H2>8. Liên hệ</H2>
        <p>
          <a className="text-primary hover:underline" href="mailto:admin@nexora-flow.cloud">
            admin@nexora-flow.cloud
          </a>
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/privacy" className="text-primary hover:underline">
          Chính sách bảo mật →
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/" className="text-primary hover:underline">
          ← Về Nexora Flow
        </Link>
      </p>
    </main>
  )
}

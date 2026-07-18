import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật',
  description:
    'Chính sách bảo mật Nexora Flow — cách nền tảng thu thập, xử lý và bảo vệ dữ liệu hồ sơ startup, tài liệu, video và tài khoản.',
  alternates: { canonical: 'https://nexora-flow.cloud/privacy' },
  openGraph: {
    title: 'Chính sách bảo mật · Nexora Flow',
    url: 'https://nexora-flow.cloud/privacy',
  },
  robots: { index: true, follow: true },
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-2 text-base font-semibold text-foreground">{children}</h2>
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="inline-flex items-center gap-2">
        <Logo size={28} />
      </Link>
      <h1 className="mt-8 font-heading text-3xl font-semibold tracking-tight">
        Chính sách bảo mật <span className="text-muted-foreground">· Privacy Policy</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cập nhật: 19/07/2026 · Nexora Flow · nexora-flow.cloud
      </p>
      <div className="mt-8 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">Nexora Flow</strong> là nền tảng so khớp
          deal-flow kết nối startup với doanh nghiệp, viện trường, quỹ đầu tư và các tổ
          chức intake (xây dựng cho hệ sinh thái Trung tâm Đổi mới sáng tạo Quốc gia —
          NIC). Chúng tôi chỉ xử lý dữ liệu để vận hành các tính năng mà bạn chủ động sử
          dụng: sàng lọc hồ sơ, chấm điểm so khớp và kết nối.
        </p>

        <H2>1. Dữ liệu chúng tôi thu thập</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Thông tin tài khoản: email, họ tên, tổ chức, vai trò.</li>
          <li>
            Hồ sơ startup và tài liệu bạn tải lên (pitch deck, báo cáo, hình ảnh) cùng dữ
            liệu được trích xuất từ chúng.
          </li>
          <li>
            Câu trả lời và <strong className="text-foreground">video tự quay</strong> mà
            bạn nộp trong các vòng thẩm định kết nối (nếu bạn tham gia).
          </li>
          <li>Hồ sơ chương trình / đơn ứng tuyển trong intake workspace.</li>
          <li>Token xác thực (JWT) và tùy chọn phiên làm việc.</li>
        </ul>

        <H2>2. Mục đích xử lý</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Trích xuất và chuẩn hóa thông tin hồ sơ bằng công nghệ AI.</li>
          <li>Chấm điểm so khớp giữa startup và tiêu chí của các tổ chức.</li>
          <li>
            Vận hành các vòng kết nối: kiểm duyệt, phỏng vấn video, câu hỏi thẩm định.
          </li>
          <li>Bảo mật tài khoản, chống lạm dụng và cải thiện chất lượng sản phẩm.</li>
        </ul>

        <H2>3. Xử lý bằng AI</H2>
        <p>
          Tài liệu và hình ảnh bạn tải lên có thể được xử lý bởi mô hình AI (bao gồm nhà
          cung cấp mô hình bên thứ ba theo hợp đồng xử lý dữ liệu) nhằm trích xuất thông
          tin và tạo gợi ý. Kết quả AI chỉ mang tính hỗ trợ ra quyết định — mọi phê duyệt
          cuối cùng do con người thực hiện. Chúng tôi không dùng dữ liệu của bạn để huấn
          luyện mô hình công khai.
        </p>

        <H2>4. Chia sẻ dữ liệu</H2>
        <p>
          Hồ sơ của bạn chỉ được chia sẻ cho một tổ chức khi{' '}
          <strong className="text-foreground">bạn chủ động gửi yêu cầu kết nối</strong>{' '}
          hoặc đã tick đồng ý tham gia so khớp. Câu trả lời và video vòng thẩm định chỉ
          được chia sẻ cho đúng tổ chức đang thẩm định kết nối đó. Thông tin liên hệ trực
          tiếp chỉ mở khi hai bên kết nối thành công. Chúng tôi không bán dữ liệu cá nhân.
        </p>

        <H2>5. Lưu trữ & bảo mật</H2>
        <p>
          Dữ liệu được lưu trên hạ tầng đám mây có kiểm soát truy cập; mật khẩu được băm;
          phiên đăng nhập dùng JWT có thời hạn. Video và file được truy cập qua định danh
          ngẫu nhiên khó đoán.
        </p>

        <H2>6. Quyền của bạn</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Xem, chỉnh sửa hồ sơ và lịch sử phiên bản bất kỳ lúc nào.</li>
          <li>Rút lại đồng ý so khớp (matching opt-in) trên trang hồ sơ của bạn.</li>
          <li>Rút yêu cầu kết nối khi còn ở trạng thái chờ duyệt.</li>
          <li>
            Yêu cầu xóa tài khoản, tài liệu hoặc video đã nộp qua email bên dưới — chúng
            tôi xử lý trong tối đa 30 ngày.
          </li>
        </ul>

        <H2>7. Đăng nhập Google</H2>
        <p>
          Đăng nhập Google (tùy chọn) chỉ dùng để tạo hoặc đăng nhập tài khoản Nexora
          Flow với phạm vi cơ bản (email, tên). Việc xác thực diễn ra trên
          accounts.google.com theo điều khoản của Google.
        </p>

        <H2>8. Liên hệ</H2>
        <p>
          Bảo mật:{' '}
          <a className="text-primary hover:underline" href="mailto:security@nexora-flow.cloud">
            security@nexora-flow.cloud
          </a>
          <br />
          Quản trị:{' '}
          <a className="text-primary hover:underline" href="mailto:admin@nexora-flow.cloud">
            admin@nexora-flow.cloud
          </a>
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/terms" className="text-primary hover:underline">
          Điều khoản sử dụng →
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/" className="text-primary hover:underline">
          ← Về Nexora Flow
        </Link>
      </p>
    </main>
  )
}

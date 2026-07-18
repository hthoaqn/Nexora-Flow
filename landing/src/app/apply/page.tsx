import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/** Bare /apply — needs a submission token from the program */
export default function ApplyIndexPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 size-80 -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
      </div>
      <Card className="relative z-10 w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <Logo size={36} />
          <CardTitle className="font-heading text-xl">Link nộp hồ sơ</CardTitle>
          <CardDescription>
            Trang này cần mã chương trình. Mở link đầy đủ từ program overview, dạng{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              /apply/&lt;token&gt;
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button className="w-full rounded-full" render={<Link href="/" />} nativeButton={false}>
            Về trang chủ
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Đăng nhập workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

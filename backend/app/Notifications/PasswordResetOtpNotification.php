<?php

declare(strict_types=1);

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class PasswordResetOtpNotification extends Notification
{
    public function __construct(private readonly string $code)
    {
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->mailer('smtp')
            ->subject('Mã OTP đặt lại mật khẩu BusNext')
            ->greeting('Xin chào ' . $notifiable->name . ',')
            ->line('Mã OTP đặt lại mật khẩu của bạn là: ' . $this->code)
            ->line('Nhập đủ 6 chữ số trong ứng dụng cùng email và mật khẩu mới. Mã hết hạn sau 5 phút và chỉ dùng một lần.')
            ->line('Bạn có tối đa 5 lần nhập sai. Có thể yêu cầu mã mới sau 60 giây; mã mới sẽ thay thế mã cũ.')
            ->line('Không chia sẻ mã này. Nếu bạn không yêu cầu, hãy bỏ qua email này.');
    }
}

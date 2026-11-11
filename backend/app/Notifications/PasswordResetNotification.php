<?php

declare(strict_types=1);

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class PasswordResetNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $token)
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
            ->subject('Đặt lại mật khẩu BusNext')
            ->greeting('Xin chào ' . $notifiable->name . ',')
            ->line('Bạn vừa yêu cầu đặt lại mật khẩu BusNext.')
            ->line('Mã khôi phục của bạn là: ' . $this->token)
            ->line('Nhập mã này trong ứng dụng cùng email và mật khẩu mới. Mã có hiệu lực trong 60 phút.')
            ->line('Nếu bạn không yêu cầu, hãy bỏ qua email này.');
    }
}

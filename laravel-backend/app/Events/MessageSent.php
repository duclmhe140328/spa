<?php

namespace App\Events;

use App\Models\Chat;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Chat $chat;

    /**
     * Create a new event instance.
     */
    public function __construct(Chat $chat)
    {
        $this->chat = $chat;
    }

    /**
     * Channel để broadcast.
     *  - chat.{user_id}.{customer_id}: cho từng cuộc chat (client dùng)
     *  - staff.{user_id}: cho màn admin (list hội thoại + messages)
     */
    public function broadcastOn()
    {
        return [
            new Channel('chat.' . $this->chat->user_id . '.' . $this->chat->customer_id),
            new Channel('staff.' . $this->chat->user_id),
        ];
    }

    /**
     * Tên event ở FE: "message.sent"
     */
    public function broadcastAs()
    {
        return 'message.sent';
    }

    /**
     * Payload gửi xuống Pusher.
     * Trả y hệt 1 record Chat như API trả.
     */
    public function broadcastWith()
    {
        return $this->chat->toArray();
    }
}

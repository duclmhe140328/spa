<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Chat;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB; // 👈 THÊM DÒNG NÀY

class ChatController extends Controller
{
    /**
     * ADMIN / STAFF LẤY LỊCH SỬ CHAT
     */
    public function indexAdmin(Request $request)
    {
        $staff = Auth::guard('api')->user(); // nhân viên / admin
        if (!$staff) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $request->validate([
            'customer_id' => 'required|string',
        ]);

        $customerId = $request->query('customer_id');

        $messages = Chat::where('user_id', $staff->id)
            ->where('customer_id', $customerId)
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($messages);
    }

    /**
     * CLIENT LẤY LỊCH SỬ CHAT
     */
    public function indexClient(Request $request)
    {
        $customer = Auth::guard('customer_api')->user();
        if (!$customer) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $request->validate([
            'user_id' => 'required|string',
        ]);

        $userId = $request->query('user_id');

        $messages = Chat::where('user_id', $userId)
            ->where('customer_id', $customer->id)
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($messages);
    }

    /**
     * ADMIN GỬI TIN CHO CLIENT
     * POST v0.0.1/admin/chat/messages
     * body: { customer_id, message }
     */
    public function storeAdmin(Request $request)
    {
        $staff = Auth::guard('api')->user();
        if (!$staff) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $data = $request->validate([
            'customer_id' => 'required|string',
            'message' => 'required|string',
        ]);

        $chat = Chat::create([
            'user_id' => $staff->id,
            'customer_id' => $data['customer_id'],
            'sender_type' => 2, // 2 = staff
            'message' => $data['message'],
        ]);

        // Broadcast realtime
        broadcast(new MessageSent($chat))->toOthers();

        return response()->json($chat, 201);
    }

    /**
     * CLIENT GỬI TIN CHO ADMIN
     * POST v0.0.1/client/chat/messages
     * body: { user_id, message }
     */
    public function storeClient(Request $request)
    {
        $customer = Auth::guard('customer_api')->user();
        if (!$customer) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $data = $request->validate([
            'user_id' => 'required|string',
            'message' => 'required|string',
        ]);

        $chat = Chat::create([
            'user_id' => $data['user_id'],
            'customer_id' => $customer->id,
            'sender_type' => 1, // 1 = customer
            'message' => $data['message'],
        ]);

        // Broadcast realtime
        broadcast(new MessageSent($chat))->toOthers();

        return response()->json($chat, 201);
    }

    /**
     * ADMIN – Lấy danh sách hội thoại (mỗi customer 1 dòng)
     * GET /api/v0.0.1/admin/chat/conversations
     */
    public function conversationsAdmin(Request $request)
    {
        $staff = Auth::guard('api')->user();
        if (!$staff) {
            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        }

        // Lấy danh sách customer đã chat với staff hiện tại
        $rows = Chat::with('customer')
            ->where('user_id', $staff->id)
            ->select(
                'customer_id',
                DB::raw('MAX(created_at) as last_message_at')
            )
            ->groupBy('customer_id')
            ->orderByDesc('last_message_at')
            ->get();

        // Map lại cho FE dễ dùng
        $conversations = $rows->map(function ($row) use ($staff) {
            // Tin nhắn cuối cùng của cặp staff - customer này
            $lastMessage = Chat::where('user_id', $staff->id)
                ->where('customer_id', $row->customer_id)
                ->latest('created_at')
                ->first();

            return [
                'customer_id' => $row->customer_id,
                'customer_name' => optional($row->customer)->full_name ?? 'Khách lạ',
                'customer_phone' => optional($row->customer)->phone ?? '',
                'customer_avatar' => null, // sau này có cột avatar thì map vào

                'last_message' => $lastMessage?->message ?? '',
                'last_time' => (string) $row->last_message_at, // FE đang dùng last_time

                // tạm thời chưa làm unread -> 0 hết, sau này nếu cần sẽ tính
                'unread_count' => 0,
            ];
        });

        return response()->json($conversations);
    }
}

<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Cho phép mọi client subscribe channel chat.* (demo)
Broadcast::channel('chat.{userId}.{customerId}', function ($user = null, $userId = null, $customerId = null) {
    return true;
});

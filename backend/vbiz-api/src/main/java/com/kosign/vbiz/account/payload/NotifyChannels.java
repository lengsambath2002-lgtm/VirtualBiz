package com.kosign.vbiz.account.payload;

/** One notification topic's channels: email and push (the inbox always gets it). */
public record NotifyChannels(boolean email, boolean push) {
}

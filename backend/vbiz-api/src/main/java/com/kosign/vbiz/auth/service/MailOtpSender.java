package com.kosign.vbiz.auth.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.auth.domain.OtpPurpose;
import com.kosign.vbiz.mail.Email;
import com.kosign.vbiz.mail.EmailSender;

import lombok.RequiredArgsConstructor;

/**
 * Where emails are on: sign-up, sign-in and password reset codes go by email (docs/ops/email.md),
 * in English and Khmer. Phone codes still go to the SMS stand-in until a gateway is contracted.
 */
@Primary
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "vbiz.mail.enabled", havingValue = "true")
public class MailOtpSender implements OtpSender {

    private final EmailSender mail;
    private final LoggingOtpSender sms;

    @Override
    public void send(OtpPurpose purpose, String target, String code) {
        if (purpose == OtpPurpose.PHONE) {
            sms.send(purpose, target, code);
            return;
        }
        String what = switch (purpose) {
            case VERIFY -> "confirm your email";
            case RESET -> "set a new password";
            default -> "sign in";
        };
        String whatKh = switch (purpose) {
            case VERIFY -> "បញ្ជាក់អ៊ីមែលរបស់អ្នក";
            case RESET -> "កំណត់ពាក្យសម្ងាត់ថ្មី";
            default -> "ចូលគណនី";
        };
        Email e = new Email()
                .preheader(code + " is your VirtualBiz code")
                .badge("VirtualBiz", null)
                .heading("Your code to " + what)
                .code(code)
                .line("Type it on the VirtualBiz page you're on. It works for 10 minutes, once.")
                .small("Didn't ask for it? Someone may have typed your email by mistake: you can ignore this email, "
                        + "your account is safe.")
                .divider()
                .heading("កូដរបស់អ្នក ដើម្បី" + whatKh)
                .code(code)
                .small("កូដនេះប្រើបាន 10 នាទី និងតែម្តងប៉ុណ្ណោះ។ បើអ្នកមិនបានស្នើ សូមមិនអើពើអ៊ីមែលនេះ។");
        mail.send(target, code + " is your VirtualBiz code", e);
    }
}

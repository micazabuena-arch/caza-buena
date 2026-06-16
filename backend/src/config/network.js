import dns from 'dns';

// Render often cannot reach IPv6 (Hostinger MySQL, Gmail SMTP, etc.)
dns.setDefaultResultOrder('ipv4first');

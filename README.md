# Let's Talkin' — Yönetim paneli

Let's Talkin' ekibinin yönetim paneli: şikayet kuyruğu, kullanıcı ve tik yönetimi,
başvurular, özellik bayrakları, denetim kaydı ve duvar ekranı (TV).

Ayrı bir projedir; yalnız backend'e (`letstalkin-backend`, `/api/v1/admin/*`) bağlanır.
Yetki sunucuda denetlenir: panel yalnız `moderator` ve `admin` rollerine açılır.

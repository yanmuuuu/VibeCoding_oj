# 阿里云 SSL 证书放置目录（勿提交 Git）
#
# 1. 登录阿里云 → SSL 证书 → 找到 rinr.top 已签发的证书 → 下载
# 2. 服务器类型选择「Nginx」
# 3. 解压后将文件重命名并放到此目录：
#      rinr.top.pem   ← 证书文件（.pem）
#      rinr.top.key   ← 私钥文件（.key）
# 4. 在服务器执行：
#      sudo bash deploy/install-https.sh
#
# 若下载的是 .crt + .key，需把「证书 + 证书链」合并为一个 pem：
#      cat 你的域名.crt 你的域名_chain.crt > rinr.top.pem
#      cp 你的域名.key rinr.top.key

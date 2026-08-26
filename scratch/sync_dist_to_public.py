import os, shutil

src = r"c:\DASHBOARD\dashboard-v2\dist"
dst = r"c:\DASHBOARD\server\public"

if os.path.exists(src):
    print("Copying dist to server/public...")
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print("Successfully copied dist -> server/public!")
else:
    print("ERROR: dist folder does not exist at", src)

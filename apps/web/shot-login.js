const { chromium, devices } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto("https://ndy-hub-web.vercel.app/login", { waitUntil: "networkidle" });
  await desktop.waitForTimeout(1200);
  await desktop.screenshot({
    path: "C:\\Users\\n8n\\AppData\\Local\\Temp\\claude\\C--Users-n8n--claude\\d2233a8b-c352-415c-9a95-8b00208eecce\\scratchpad\\login-desktop.png",
    fullPage: true,
  });

  const mobile = await browser.newPage(devices["iPhone 13"]);
  await mobile.goto("https://ndy-hub-web.vercel.app/login", { waitUntil: "networkidle" });
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({
    path: "C:\\Users\\n8n\\AppData\\Local\\Temp\\claude\\C--Users-n8n--claude\\d2233a8b-c352-415c-9a95-8b00208eecce\\scratchpad\\login-mobile.png",
    fullPage: true,
  });
  const scrollWidth = await mobile.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await mobile.evaluate(() => document.documentElement.clientWidth);
  console.log("Mobile scrollWidth:", scrollWidth, "clientWidth:", clientWidth, "overflow:", scrollWidth > clientWidth + 2);

  await browser.close();
})();

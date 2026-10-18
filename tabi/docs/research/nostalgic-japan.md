# Research log — Nostalgic Japan (`nostalgic-japan`)

Researched and written 18 October 2026 by Tabi Guides. The brochure is a **photo essay**: real
photographs of nostalgic (懐かしい, *natsukashii*) places across Japan, with short captions. It has
**no map pages**. Research used web search only: outside sites could not be opened from the
sandbox (WebFetch/curl blocked), so every value below comes from search-result extracts of the pages
listed. **40 web searches** were used (23 for Commons photos, 17 for facts and coordinates).

`factsChecked: "October 2026"` is set. The only clock times printed are the Toki no Kane bell times
(four sources agree). Walking times are printed with "about". **No prices are printed anywhere.**
Tourist-office opening hours were found but conflict between sources, so none are printed. Phone
numbers are never printed.

Status key: **VERIFIED** = printed value matches the sources listed · **HEDGED** = sources disagree
or are thin, so the copy uses "about", "usually" or looser wording · **REMOVED** = could not be
verified, not printed.

## Page plan (16 pages)

| # | id | type | content |
|---|---|---|---|
| 1 | p1 | cover | Ginzan Onsen in the snow (`nostalgic-ginzan`) |
| 2 | p2 | intro | What *natsukashii* means; photo Shimonada Station (`nostalgic-shimonada`) |
| 3 | p3 | place | Kawagoe: the kura street & Toki no Kane (`nostalgic-kawagoe`) |
| 4–5 | p4/p5 | photo spread (left at index 3, right at 4) | Kurashiki Bikan canal (`nostalgic-spread`) |
| 6 | p6 | place | Kurashiki Bikan Historical Quarter (`nostalgic-kurashiki`) |
| 7 | p7 | gallery | Post towns: Ōuchi-juku, Tsumago-juku, Narai-juku |
| 8 | p8 | photo (full page) | Yasaka-dōri and the Yasaka Pagoda, Kyoto (`nostalgic-fullpage`) |
| 9 | p9 | features (with photos) | Higashi Chaya (Kanazawa), Kakunodate, Uchiko |
| 10 | p10 | gallery | Shibamata, Bungotakada Shōwa no Machi, Onomichi |
| 11 | p11 | gallery | Ginzan Onsen at night, Otaru Canal, Ōmi-Hachiman Hachimanbori |
| 12 | p12 | agenda | "The nostalgic hours" (times of day / season, no prices) |
| 13 | p13 | phrases | Words for old places |
| 14 | p14 | quote | Bashō, 此道や行人なしに秋の暮 |
| 15 | p15 | contact | Visitor information (official sites only) |
| 16 | p16 | back | Sign-off |

`brochures.test.js` allows exactly one full-page photo and one double-page spread per brochure, so
the rest of the essay is carried by photo-led `place` pages, three `gallery` pages and a `features`
page whose items carry photos. 18 photo slots, 15 places, every region from Hokkaidō to Kyūshū.

## Facts

| # | Claim (where used) | Value used | Sources | Status |
|---|---|---|---|---|
| 1 | *Natsukashii* meaning (intro, phrases) | "the warm, wistful feeling of meeting something dear from long ago" | Standard dictionary sense; same wording as the Home page's Nostalgic section (src/pages/Home/homeContent.js) | VERIFIED (language note) |
| 2 | Ginzan Onsen: multi-storey wooden inns along the Ginzan River, Taishō-era townscape (cover caption, p11) | "Taishō-era wooden inns along the Ginzan River" | https://www.mlit.go.jp/tagengo-db/R3-00448.html (MLIT: 「銀山温泉 / 大正時代の家並」, logged in docs/research/tohoku-summer-festivals.md) · https://japanactivity.com/ginzan-onsen-taisho-street · https://www.pakutaso.com/en/20160220054post-7049.html · https://jw-webmagazine.com/tips/ginzan-onsen | VERIFIED — but rebuild dates differ (after the 1913 flood, 1920s, "early Shōwa" in one source), so no year is printed. |
| 3 | Ginzan Onsen: gas lamps lit along the river after dark (p11, agenda) | "gas lamps light the wooden inns along the river after dark" | https://watabi.org/en/articles/ginzan-onsen-day-vs-overnight · https://onsenoni.com/en/onsenchi/ginzan · https://jw-webmagazine.com/tips/ginzan-onsen | VERIFIED. Number of lamps (88, one source) REMOVED. |
| 4 | Ginzan Onsen: best seen staying overnight (agenda) | "Stay the night to see them after the day visitors have gone" | https://watabi.org/en/articles/ginzan-onsen-day-vs-overnight | HEDGED — printed as advice. "Last buses leave early" (one source) REMOVED. |
| 5 | Snow at Ginzan and Ōuchi-juku in midwinter (agenda) | as printed | Commons: File:Ginzan Onsen (32165662644).jpg ("snowy day", 31 Jan 2017) · https://id.jal.japantravel.com/places/fukushima/ouchi-juku/144 ("Ouchi-juku under snow") · watabi (late Jan–mid Feb snow) | VERIFIED (no dates printed). |
| 6 | Ginzan Onsen coordinates (brochure `location`) | 38.5697, 140.5311 | https://en.wikipedia.org/wiki/Ginzan_Onsen (38°34′11″N 140°31′52″E) · https://www.travelprofy.com/tokyo/ginzan-onsen (38.5705, 140.5305) | VERIFIED (sources within ~100 m) |
| 7 | Kawagoe calls itself Koedo, "Little Edo"; kurazukuri storehouse-style shop-houses (p3) | as printed | Commons: File:Kurazukuri Street in Little Edo.jpg (蔵造りの町並み) · https://www.city.kawagoe.saitama.jp/kanko/k-benri/1011622.html (KOEDO KAWAGOE Tourist Association) · https://en.wikivoyage.org/wiki/Kawagoe (via search mirror) | VERIFIED |
| 8 | Toki no Kane first built in the early Edo period (p3) | "first raised in the early Edo period" | https://en.wikipedia.org/wiki/Time_Bell_Tower · https://samurai-archives.com/wiki/Toki_no_kane (Kan'ei era, 1624–43, under Sakai Tadakatsu) | VERIFIED — exact first year disputed (1627–34), not printed. |
| 9 | Present tower rebuilt in 1894 after the Great Fire of Kawagoe (p3) | 1894 | https://en.wikipedia.org/wiki/Time_Bell_Tower (4th generation, 1894, a year after the 1893 fire) · https://hiddenjapan-gems.com/toki-no-kane-kawagoe-bell-tower/ · https://cdn.gltjp.com/en/directory/item/11437 | VERIFIED — one source says fire 1892 / rebuilt 1893; majority 1893/1894. |
| 10 | Tower about 16 m tall (p3) | "about 16 m" | https://hiddenjapan-gems.com/toki-no-kane-kawagoe-bell-tower/ · https://www.timeout.jp/tokyo/things-to-do/toki-no-kane-time-bell-tower | VERIFIED ("about") |
| 11 | Bell rings four times a day: 6:00, 12:00, 15:00, 18:00 (p3 facts, agenda) | as printed | https://en.wikipedia.org/wiki/Time_Bell_Tower · https://cdn.gltjp.com/en/directory/item/11437 · https://www.timeout.jp/tokyo/things-to-do/toki-no-kane-time-bell-tower · https://hiddenjapan-gems.com/tag/toki-no-kane/ | VERIFIED |
| 12 | Its sound is one of the "100 Soundscapes of Japan" (p3) | as printed (no year) | https://en.wikipedia.org/wiki/Time_Bell_Tower (selected 1996) · https://hiddenjapan-gems.com/toki-no-kane-kawagoe-bell-tower/ | VERIFIED |
| 13 | About 10–15 min walk from Seibu Hon-Kawagoe Station (p3 facts) | as printed | https://hiddenjapan-gems.com/kawagoe-sightseeing-guide/ ("10–15 minute walk") · https://www.gltjp.com/fr/article/item/20523/ (about 10 min) · https://www.jeepe.jp/en/articles/kawagoe-day-trip-course-2470 (about 15 min) | VERIFIED (range) |
| 14 | Tourist information at Kawagoe Station (p3 facts, contact) | "At Kawagoe Station" | https://en.chocotabi-saitama.com/spot/20875 (Saitama Prefecture tourism) · Wikivoyage Kawagoe (24-9 Wakitamachi, at Kawagoe Station) | VERIFIED — opening hours conflict (9:00–16:30 vs seasonal), REMOVED. Phone REMOVED. Koedo Loop Bus fares (¥400/¥500 conflict) REMOVED. |
| 15 | Toki no Kane coordinates (p3) | 35.9235, 139.4833 | https://en.wikipedia.org/wiki/Time_Bell_Tower (35°55′24.56″N 139°28′59.93″E) · https://aroundus.com/p/164491750-time-bell-tower (35.92348, 139.48334) | VERIFIED |
| 16 | Kurashiki ruled directly by the shogunate; rice collection and trade centre (p6) | as printed | https://www.gltjp.com/en/directory/item/11410/ (direct control from 1642, rice) · https://www.westjr.co.jp/travel-information/en/explore-west-japan/destinations-okayama/kurashiki-bikan-historical-quarter/ · https://edolegacytravel.metro.tokyo.lg.jp/spots/kurashiki-bikan-historical-area/ | VERIFIED — year 1642 from one source, not printed. |
| 17 | White-walled storehouses, namako-kabe, willows along the Kurashiki River (p4/5 caption, p6) | as printed | WestJR (above) · https://www.okayama-japan.jp/de/spot/886 (Okayama Prefecture tourism) · Commons Category:Kurashiki Bikan historical quarter (next to Kurashiki River) | VERIFIED |
| 18 | Ohara Museum of Art: Japan's first private museum of Western art (p6) | as printed | WestJR (above) · https://en.wikivoyage.org/wiki/Kurashiki | VERIFIED |
| 19 | About 15 min walk from JR Kurashiki Station (p6 facts) | as printed | WestJR (above, "Approx. 15-minute walk") · https://www.city.kurashiki.okayama.jp/_res/projects/default_project/_page_/001/002/247/course1.pdf (route via covered shopping streets) | VERIFIED |
| 20 | Kurashiki coordinates (p6) | 34.5964, 133.7709 | https://aroundus.com/p/164536366-kurashiki-bikan-historical-quarter (34.59643, 133.77088) · https://en.japantravel.com/places/japan/kurashiki-bikan-historical-quarter/634 (34.5957, 133.7718) | VERIFIED (within ~120 m) |
| 21 | Kurashiki river-boat fare (¥700) | — | https://sa.trip.com/moments/kurashiki-56976 (one travel blog) | REMOVED (no price printed) |
| 22 | Ōuchi-juku: post town on the Aizu-Nishi Kaidō, thatched houses on its main street, Shimogō, Fukushima (p7) | as printed | https://www.tokyoweekender.com/?p=285411 · https://en.japantravel.com/places/japan/ouchi-juku/144 · https://en.wikipedia.com/wiki/Ouchijuku · Commons Category:Ouchi-juku (Important Preservation District; Shimogō, Minamiaizu) | VERIFIED — founding (~1643) and house count (30+) from one source each, not printed. Designation year not found, not printed. |
| 23 | Tsumago-juku: 42nd station of the Nakasendō (p7) | as printed | Commons Category:Tsumago-juku ("42nd station of the Nakasendō", Nagiso, Kiso district) · https://www.japan-alps.com/tsumago/ | VERIFIED |
| 24 | Tsumago residents' rule "don't sell, don't rent, don't destroy" (売らない・貸さない・壊さない) (p7) | as printed | https://www.japan-alps.com/tsumago/ (1968 residents' charter) · https://www.ana.co.jp/en/us/japan-travel-planner/nagano/0000009.html · https://hiddenjapan-gems.com/tsumago-juku-nakasendo-trail/ | VERIFIED — "first in Japan" claims contested, not printed. |
| 25 | Narai-juku: 34th of the Nakasendō's 69 stations, on the Kiso road (p7) | as printed | Commons Category:Narai-juku ("station on the Nakasendō, the Kiso road"; Important Preservation District 1978) · Commons File:Narai post town.JPG (description: 34th of 69 stations) | VERIFIED |
| 26 | Yasaka Pagoda: five-storey pagoda of Hōkan-ji on Yasaka-dōri (p8) | as printed | Commons Category:Hōkanji (five-storied pagoda, on Yasaka Street) · Commons File:Yasaka-dori early morning with street lanterns and the Tower of Yasaka (Hokan-ji Temple), Kyoto, Japan.jpg (Picture of the Day, 9 March 2021) · Commons File:Hōkan-ji Yasaka Pagoda, Kyoto (法観寺 八坂の塔, 京都), circa 1900.jpg (Japanese name 八坂の塔) | VERIFIED. "Dawn ... lanterns still lit" (agenda) describes the photograph. |
| 27 | Higashi Chaya laid out by the Kaga domain in 1820; kimusuko lattices (p9) | as printed | https://www.japan.travel/en/japans-local-treasures/higashi-chaya-district/ (JNTO) · https://www.tokyoweekender.com/?p=288449 · https://japanactivity.com/higashi-chaya-district-guide | VERIFIED. Designation year (2001) not found, not printed. |
| 28 | Kakunodate: samurai houses behind black wooden fences; weeping cherries, usually late April (p9, agenda) | as printed | https://cdn.gltjp.com/en/directory/item/11573/ · https://www.japan.travel/en/japans-local-treasures/kakunodates-bukeyashiki-district · https://japanactivity.com/kakunodate-attractions (late April) | VERIFIED / HEDGED ("usually"). Kyoto origin of the trees and tree counts REMOVED. |
| 29 | Uchiko grew rich on wax and paper (p9, Uchiko caption) | as printed | https://en.wikipedia.org/wiki/Uchiko,_Ehime · https://www.japan-guide.com/e/e5550.html · https://jal.japantravel.com/ehime/uchiko | VERIFIED. "30% of Japan's wax" (one source) REMOVED. |
| 30 | Uchiko-za built 1916, still holds shows (p9) | as printed | https://en.wikipedia.org/wiki/Uchiko,_Ehime · https://www.japan-guide.com/e/e5550.html | VERIFIED |
| 31 | Shibamata: about 200 m shop-lined approach from Keisei Shibamata Station to Taishakuten; kusa dango (p10) | "the shop-lined approach to Taishakuten temple, known for kusa dango" | https://www.gotokyo.org/en/spot/33/index.html (Go Tokyo) · https://voyapon.com/shibamata-tokyo/ · https://www.kanpai-japan.com/tokyo/shibamata · https://www.timeout.com/tokyo/restaurants/monzen-toraya | VERIFIED. Shop names, addresses and prices not printed. |
| 32 | Bungotakada Shōwa no Machi: shopping street recreating the 1950s–60s, revived from about 2001 (p10) | "brought back to its 1950s–60s look" | https://en.wikipedia.org/wiki/Showa_no_Machi · https://www.mlit.go.jp/tagengo-db/en/R1-02604.html · https://www.gltjp.com/en/directory/item/19224/ | VERIFIED — one source says "mid-Shōwa"; "1950s–60s" matches the others. Visitor numbers not printed. |
| 33 | Onomichi: Senkō-ji on the hillside above the town and the Onomichi Channel (p10) | as printed | Commons Category:Onomichi Channel (views of the channel from the path to Senkō-ji) · Commons File:Senkoji Temple 千光寺 - panoramio (1).jpg | VERIFIED (describes what the photos show). |
| 34 | Otaru Canal: old warehouses along the canal of a port town (p11) | as printed | Commons Category:Otaru Canal (subcategory "Warehouses along the Otaru Canal") · Commons Category:Former Otaru Warehouse (historic landmark) · Commons Category:Port of Otaru | VERIFIED (no dates printed). |
| 35 | Ōmi-Hachiman: Hachimanbori dug in 1585 (Toyotomi Hidetsugu) to link the merchant town with Lake Biwa (p11) | as printed | https://www.omi8.com/welcome-e/hachimanbori/ (Ōmi-Hachiman tourism) · https://www.mlit.go.jp/tagengo-db/R4-00572.html · https://www.mlit.go.jp/tagengo-db/common/001653109.docx | VERIFIED |
| 36 | Shimonada Station: on the JR Yosan Line, Iyo, Ehime, beside the Seto Inland Sea (intro photo) | as printed | Commons Category:Shimonada Station (Yosan Line, Iyo City, Ehime; related Category:Iyo Sea; file 下灘駅と瀬戸内海.jpg) | VERIFIED (describes the place and photo). |
| 37 | Quote (p14) | 此道や行人なしに秋の暮 — Matsuo Bashō; recorded in *Oi nikki* (笈日記) | https://www.kodansha.co.jp/book/products/0000146344 (text, and the *Oi nikki* account of Bashō choosing it over 人声やこの道かへる秋の暮) · https://osaka-info.jp/spot/monuments-engraved-bashos-poetry-1 | VERIFIED — composition year (usually given as 1694, the year of Bashō's death) not confirmed by the extracts, so not printed. English is Tabi Guides' own translation (labelled). |
| 38 | Phrases (p13) | 懐かしいですね · 昭和レトロ · 町並み · 宿場町 · 蔵造り · 古民家 | Standard Japanese; 蔵造りの町並み in Commons file description (Kawagoe); 昭和レトロ / 昭和の町 in sources 32 | VERIFIED (language) |

## Japanese names

| Place | Japanese | Where it is checked |
|---|---|---|
| Ginzan Onsen | 銀山温泉 | Commons file titles (銀山温泉 - 旅館松本 …) |
| Shimonada Station | 下灘駅 | Commons Category:Shimonada Station (下灘駅と瀬戸内海.jpg) |
| Kawagoe kura street, Toki no Kane | 川越 蔵造りの町並み・時の鐘 | Commons File:Kurazukuri Street in Little Edo.jpg; Wikipedia Time Bell Tower |
| Little Edo | 小江戸 | Commons File:小江戸の夜(Kawagoe at night) 31 Oct, 2015 - panoramio.jpg |
| Kurashiki Bikan Historical Quarter | 倉敷美観地区 | Commons file 倉敷美觀地區 (traditional form of 観) |
| Yasaka Pagoda | 八坂の塔 (法観寺) | Commons File:Hōkan-ji Yasaka Pagoda, Kyoto (法観寺 八坂の塔, 京都), circa 1900.jpg |
| Post town | 宿場町 | phrases page |

## Photos

All candidates below appeared as Commons **file pages** in this session's search results (titles are
the URL with underscores → spaces, percent-decoded). Category-only listings were not used as
candidates. Every slot also has a Commons `query` for the live fallback. Credits are filled in
automatically.

| Slot (use) | Candidates, best first | Notes |
|---|---|---|
| `nostalgic-ginzan` (cover) | File:Ginzan Onsen (32165662644).jpg · File:Yamagata-Ginzan Onsen-m.jpg · File:Ginzan Onsen 01.jpg | #1 is a snowy-day portrait, 3,024 × 4,032, CC BY-SA 2.0 (Flickr, 31 Jan 2017) — ideal cover. |
| `nostalgic-spread` (spread) | File:161015 At Kurashiki Bikan historical quarter Kurashiki Okayama pref Japan01s3.jpg · File:080727 At Kurashiki Bikan historical quarter Kurashiki Okayama pref Japan01s3.jpg · File:Kurashiki Bikan historical quarter 20190324.jpg | Curator: pick the widest canal view that still works split down the middle. 2019 files CC BY-SA 4.0. |
| `nostalgic-fullpage` (full) | File:Yasaka-dori early morning with street lanterns and the Tower of Yasaka (Hokan-ji Temple), Kyoto, Japan.jpg · File:Yasaka Pagoda (24554839319).jpg · File:Pagode in Yasaka - Pagoda in Yasaka (3774886132).jpg · File:Yasaka Pagode.jpg | #1 was Commons Picture of the Day (9 March 2021). |
| `nostalgic-tsumago` (wide) | File:Tsumago-juku 1.jpg · File:Tsumago-juku 3.jpg · File:Tsumago-juku, Nagiso, Nagano, Japan (3599669155).jpg · File:Tsumago 2009 4.JPG | #1 Terashita street scene (2006, CC BY-SA 3.0). Left out: File:Tsumago.jpg (wide town view, not a street). |
| `nostalgic-shibamata` (wide) | File:Taishakuten Sando -01.jpg · File:Taishakuten Sando -02.jpg · File:Shibamata street.jpg | #3 rainy street, CC BY 2.0 (2008). Left out: File:Shibamata Taishakuten.jpg (temple, not the street). |
| `nostalgic-shimonada` (wide) | File:Shimonada Station platform 20160917.jpg · File:Shimonada Station 201507(2).JPG · File:Shimonada Station - panoramio.jpg · File:Shimonada Station 201507(4).JPG | #1 CC BY-SA 2.0 (Flickr). Left out: the running-in board close-up. |
| `nostalgic-ouchi` (wide) | File:Ouchi-juku, Fukushima 01.jpg · File:Ouchijuku 1.JPG · File:Ja-fukushima-ohuchijuku-7.jpg | #1 2017, GFDL / CC BY 4.0. |
| `nostalgic-kawagoe` (wide) | File:TokiNoKane Kawagoe 2013Feb.JPG · File:Kawagoe Toki no Kane 5.jpg · File:Tokinokane-2006-03-20 1.jpg · File:Kurazukuri Street in Little Edo.jpg | #4 shows the street rather than the bell tower; keep last. |
| `nostalgic-kurashiki` (wide) | File:Kurashiki Bikan historical quarter 20190324-2.jpg · File:Kurashiki Bikan Historical Quarter 倉敷美觀地區 - panoramio (2).jpg | Only two distinct from the spread's candidates; query as fallback. |
| `nostalgic-narai` (wide) | File:Nakasendo Narai-juku08n4272.jpg · File:Narai post town.JPG · File:Narai, Shiojiri, Nagano Prefecture 399-6303, Japan - panoramio.jpg | Left out: File:Shiojiri montage.JPG (collage). |
| `nostalgic-higashi-chaya` (any) | File:Higashi Chaya district, Kanazawa (3810720612).jpg · File:Higashi chaya gai005.jpg · File:Higashi chaya gai003.jpg | #1 CC BY 2.0 (Flickr); #2–3 Kanazawa city open data. Also seen, not used: File:01 Fanal de paper (chochin) i cases de te (chaya) al barri de Higashi-chaya (Kanazawa).jpg, File:10 Sugidama, Higashi-chaya (Kanazawa).jpg. |
| `nostalgic-kakunodate` (any) | File:Bukeyashiki Street in Kakunodate 20060506.jpg · File:Bukeyashiki Street in Kakunodate 20120108b.jpg | #1 spring (weeping cherry), #2 January. Left out: File:Kakunodate street.JPG (commercial street). |
| `nostalgic-uchiko` (any) | File:Uchiko1,Uchiko-town,Japan.JPG · File:Uchiko Wikivoyage banners.jpg | #2 is a very wide banner crop — use only if #1 fails; query as fallback. |
| `nostalgic-bungotakada` (wide) | File:Bungotakada showa no machi.JPG | **Only one candidate found** (two searches): 1,600 × 1,200, CC BY 3.0, July 2003, a Daihatsu Midget on display. Below the ~2,000 px guideline; the `query` is the main route to a better file. |
| `nostalgic-onomichi` (wide) | File:Senkoji Onomichi16s3872.jpg · File:Senkoji Temple 千光寺 - panoramio (1).jpg · File:千光寺 Senko-ji Temple - panoramio.jpg · File:Onomichi City Hiroshima Prefecture.jpg | Curator: prefer a view with the town and channel below. Left out: File:Onomichi 97.jpg (content unknown). |
| `nostalgic-ginzan-lamps` (wide) | File:Ginzan Onsen - Inns (銀山温泉 - 旅館松本, 昭和館, 銀山川, 八木橋商店, 旅籠いとうや, 能登屋旅館, 旅館永澤平八, かじか庵, 旅館藤屋) (2015-03-07 by Eiji Kikuta @Pixabay 1366873).jpg · File:Ginzan Onsen Noto-ya Ryokan with a sign of founder, Kido Sasaemon, in Hanazawa, Yamagata (山形県銀山温泉 能登屋旅館 と 創業者・木戸佐左エ門の大看板) (2015-03-07 by Eiji Kikuta @Pixabay 1366872).jpg | Both CC0 (Pixabay), winter evening. Curator: check #1 is not mostly black. Left out: File:Ginzan Onsen 2019 no.3.png. |
| `nostalgic-otaru` (wide) | File:Otaru Canal 20140817.jpg · File:220721 Former Masuda Warehouse Otaru Hokkaido Japan01s3.jpg · File:Otaru Canal HDR2.jpg | #3 is HDR — last resort. Left out: File:Otaru Montage.jpg (collage). |
| `nostalgic-omihachiman` (wide) | File:Omihachiman City Hachimanbori.JPG · File:Omihachiman nishikawa house01s3200.jpg | #2 shows the Nishikawa merchant house rather than the canal — if chosen, update `alt`. |

Searched with no usable file pages (category listings only), so not in the brochure: Miyama
Kayabuki-no-Sato (Kyoto), Mameda-machi (Hita), Kitsuki's Suya-no-saka slope (only one file page:
File:Castle Town of Kitsuki 05.jpg), Yanagawa canals.

**Verified candidate count:** 52 Commons file titles across 18 slots (17 slots with 2–4 candidates;
`nostalgic-bungotakada` with 1).

## Sources (brochure `sources`, official first)

City of Kawagoe · Chocotabi Saitama (Saitama Prefecture) · Okayama Prefecture tourism · JR West ·
omi8.com (Ōmi-Hachiman) · Japan Tourism Agency multilingual database (Shōwa no Machi, Ginzan Onsen) ·
JNTO japan.travel (Higashi Chaya, Kakunodate) · Go Tokyo (Shibamata) · Wikipedia (Time Bell Tower,
Uchiko, Showa no Machi) · japan-guide.com (Uchiko) · japan-alps.com (Tsumago).

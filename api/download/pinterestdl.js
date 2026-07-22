const express = require("express");
const axios = require("axios");

const router = express.Router();

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6",
    "Content-Type": "application/json",
    "x-csrftoken": "daaaed19c58a2787b0d6a23620be18e1",
    "Cookie": "csrftoken=daaaed19c58a2787b0d6a23620be18e1; _auth=1"
};

async function parsePinterestId(url) {
    let finalUrl = url;

    if (/pin\.it/i.test(url)) {
        const r = await axios.head(url, {
            maxRedirects: 5
        });

        finalUrl =
            r.request?.res?.responseUrl ||
            r.config?.url;
    }

    const id = finalUrl.match(/\/pin\/(\d+)/)?.[1];

    if (!id) {
        throw new Error("Pin ID tidak ditemukan.");
    }

    return id;
}

function serialize(d1, d2) {
    const a = d1?.data?.v3GetPinQueryv2?.data || {};
    const b = d2?.data?.v3GetPinQueryv2?.data || {};

    const user = {
        fullName:
            b?.pinner?.fullName ||
            b?.nativeCreator?.fullName ||
            a?.closeupAttribution?.fullName ||
            a?.nativeCreator?.fullName ||
            "(unknown)",

        username:
            b?.pinner?.username ||
            a?.nativeCreator?.username ||
            a?.pinner?.username ||
            "(unknown)"
    };

    const post = {
        title:
            b?.title?.trim() ||
            b?.closeupUnifiedDescription?.trim() ||
            b?.description?.trim() ||
            "(no title)",

        description:
            b?.description?.trim() ||
            b?.closeupUnifiedDescription?.trim() ||
            "",

        likesCount:
            b?.totalReactionCount || 0,

        commentCount:
            b?.aggregatedPinData?.commentCount || 0,

        createdAt:
            b?.createdAt || "(unknown)"
    };

    const video =
        b?.storyPinData?.pages?.[0]?.blocks?.[0]?.videoDataV2?.videoList720P?.v720P ||
        b?.videos?.videoList?.v720P;

    const images = Object.keys(a)
        .filter(key => key.startsWith("images_"))
        .map(key => ({
            quality: key.replace("images_", ""),
            ...a[key]
        }));

    return {
        user,
        post,
        content: {
            images,
            videos: video ? [video] : []
        }
    };
}

async function pinterest(url) {
    const pinId = await parsePinterestId(url);

    const [r1, r2] = await Promise.all([
        axios.post(
            "https://id.pinterest.com/_/graphql/",
            {
                queryHash: "5444a9d6e1f023c6785830bbadc6f60fe2bb7a8775b86f77905d400cfb06991b",
                variables: {
                    pinId,
                    isAuth: true,
                    isDesktop: false,
                    isUnauth: false,
                    shouldPrefetchStoryPinFragment: false,
                    shouldSkipImageViewerOnPageQuery: true
                }
            },
            {
                headers: HEADERS
            }
        ),

        axios.post(
            "https://id.pinterest.com/_/graphql/",
            {
                queryHash: "a03317b3c9329575ec06fe3aeff2a3f194dae93a4eaaf4d16eab671fd2efd198",
                variables: {
                    pinId,
                    isAuth: true,
                    isDesktop: false,
                    isUnauth: false,
                    shouldDefer: false,
                    shouldFetchAIInsight: false,
                    shouldShowSeoDrawerOption: false
                }
            },
            {
                headers: HEADERS
            }
        )
    ]);

    return serialize(r1.data, r2.data);
}

router.get("/", async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter url wajib diisi.",
                example: "/api/search/pinterest?url=https://pin.it/3yi7VCBTm"
            });
        }

        const result = await pinterest(url);

        res.json({
            status: true,
            creator: "ArulzXD",
            result
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message:
                err.response?.data ||
                err.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
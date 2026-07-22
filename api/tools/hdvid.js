const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const crypto = require("crypto");

const router = express.Router();

const UA =
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function headers(extra = {}) {
const SERIAL = crypto
.createHash("md5")
.update(UA + Date.now())
.digest("hex");

return {
    accept: "*/*",
    "product-serial": SERIAL,
    "user-agent": UA,
    Referer: "https://unblurimage.ai/",
    ...extra
};

}

router.get("/", async (req, res) => {
try {
const videoUrl =
req.query.url?.trim();

    if (!videoUrl) {
        return res.status(400).json({
            status: false,
            creator: "ArulzXD",
            message:
                "Parameter url wajib diisi",
            example:
                "/api/tools/hdvideo?url=https://example.com/video.mp4"
        });
    }

    const videoBuffer =
        Buffer.from(
            (
                await axios.get(
                    videoUrl,
                    {
                        responseType:
                            "arraybuffer"
                    }
                )
            ).data
        );

    // Register File
    const fileName =
        crypto.randomBytes(3)
            .toString("hex") +
        "_video.mp4";

    const formReg =
        new FormData();

    formReg.append(
        "video_file_name",
        fileName
    );

    const reg =
        await axios.post(
            "https://api.unblurimage.ai/api/upscaler/v1/ai-video-enhancer/upload-video",
            formReg,
            {
                headers: {
                    ...headers(),
                    ...formReg.getHeaders()
                }
            }
        );

    const {
        url: ossUrl,
        object_name: objectName
    } = reg.data.result;

    // Upload OSS
    await axios.put(
        ossUrl,
        videoBuffer,
        {
            headers: {
                "Content-Type":
                    "video/mp4",
                "User-Agent":
                    UA
            }
        }
    );

    // Create Job
    const formJob =
        new FormData();

    formJob.append(
        "original_video_file",
        `https://cdn.unblurimage.ai/${objectName}`
    );

    formJob.append(
        "resolution",
        ""
    );

    formJob.append(
        "is_preview",
        "false"
    );

    const create =
        await axios.post(
            "https://api.unblurimage.ai/api/upscaler/v2/ai-video-enhancer/create-job",
            formJob,
            {
                headers: {
                    ...headers(),
                    ...formJob.getHeaders()
                }
            }
        );

    const jobId =
        create.data.result?.job_id;

    if (!jobId) {
        return res.status(500).json({
            status: false,
            message:
                "Gagal membuat job"
        });
    }

    let outputUrl = null;

    for (
        let i = 0;
        i < 60;
        i++
    ) {
        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    5000
                )
        );

        const check =
            await axios.get(
                `https://api.unblurimage.ai/api/upscaler/v2/ai-video-enhancer/get-job/${jobId}`,
                {
                    headers:
                        headers()
                }
            );

        if (
            check.data.result
                ?.output_url
        ) {
            outputUrl =
                check.data.result.output_url;

            break;
        }
    }

    if (!outputUrl) {
        return res.status(408).json({
            status: false,
            message:
                "Timeout atau gagal memproses video"
        });
    }

    res.json({
        status: true,
        creator: "ArulzXD",
        result: {
            job_id: jobId,
            video: outputUrl
        }
    });

} catch (err) {
    res.status(500).json({
        status: false,
        creator: "ArulzXD",
        message: err.message
    });
}

});

router.status = "ready";
router.type = "free";

module.exports = router;
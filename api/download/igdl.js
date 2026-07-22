const axios = require('axios');
const express = require('express');
const router = express.Router();

// Endpoint GET Utama
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter"
        });
    }

    try {
        const headers = {
            "X-IG-App-ID": "936619743392459",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
        };

        // =========================
        // INSTAGRAM STORIES
        // =========================
        if (url.includes('/stories/')) {
            try {
                const [, user, id] = new URL(url)
                    .pathname
                    .split('/')
                    .filter(Boolean);

                const html = await axios.get(url, { headers });

                const usr = JSON.parse(
                    html.data.match(/"user":({.*?})/)[1]
                );

                const story = await axios.get(
                    `https://i.instagram.com/api/v1/feed/user/${usr.id}/story/`,
                    {
                        headers: {
                            ...headers,
                            Cookie: "sessionid=73826068448%3ADgDR5B27lWO3jj%3A29%3AAYhfMw1MuDgYDu4EV5lEBpjiYhlCTozFlQioMyFHxA;"
                        }
                    }
                );

                const item = story.data.reel.items.find(
                    v => v.id.split('_')[0] === id
                );

                if (!item) {
                    return res.status(404).json({
                        status: false,
                        error: 'Story not found'
                    });
                }

                const media = item.video_versions
                    ? item.video_versions[0].url
                    : item.image_versions2.candidates[0].url;

                return res.status(200).json({
                    status: true,
                    creator: 'Arulzxd',
                    result: {
                        type: 'story',
                        author: {
                            username: usr.username,
                            name: story.data.reel.user.full_name,
                            id: usr.id,
                            profile: usr.profile_pic_url
                        },
                        uploadAt: new Date(item.taken_at * 1000).toLocaleString('id-ID'),
                        media
                    }
                });

            } catch (e) {
                return res.status(500).json({
                    status: false,
                    error: 'Konten bermasalah / private / expired'
                });
            }
        }

        // =========================
        // POST / REEL / TV
        // =========================
        const code = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/)?.[1];

        if (!code) {
            return res.status(400).json({
                status: false,
                error: 'Invalid Instagram URL'
            });
        }

        const query = new URLSearchParams({
            doc_id: "8845758582119845",
            variables: JSON.stringify({
                shortcode: code
            })
        });

        const response = await axios.get(
            `https://www.instagram.com/graphql/query/?${query}`,
            { headers }
        );

        const media = response.data?.data?.xdt_shortcode_media;

        if (!media) {
            return res.status(404).json({
                status: false,
                error: 'Konten private / followers only'
            });
        }

        const side = media.edge_sidecar_to_children?.edges || [];

        const medias = side.length
            ? side.map(x => x.node.video_url || x.node.display_url)
            : media.video_url || media.display_url;

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result: {
                type: side.length ? 'slide' : media.is_video ? 'video' : 'photo',
                caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || "",
                media: medias,
                author: {
                    username: media.owner.username,
                    name: media.owner.full_name,
                    followers: media.owner?.edge_followed_by?.count || 0,
                    profile: media.owner?.profile_pic_url || null
                },
                stats: {
                    like: media?.edge_media_preview_like?.count || 0,
                    comments: media?.edge_media_preview_comment?.count || 0,
                    views: media.video_view_count || media.video_play_count || null,
                    duration: media.video_duration || null
                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
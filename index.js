// index.js

import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { ReactNative as RN } from "@vendetta/metro/common";

const UploadModule = findByProps("uploadAttachment");
const MessageActions = findByProps("sendMessage");
const ActionSheet = findByProps("openLazy", "hideActionSheet");
const Permissions = findByProps("requestMultiple", "check");
const DocumentPicker = findByProps("pick", "pickSingle");

let patches = [];

async function requestPermissions() {
    try {
        await Permissions.requestMultiple([
            "android.permission.READ_MEDIA_VIDEO",
            "android.permission.READ_EXTERNAL_STORAGE"
        ]);
    } catch (e) {
        console.log("Permissions error", e);
    }
}

async function pickVideo() {
    try {
        const result = await DocumentPicker.pickSingle({
            type: ["video/*"]
        });

        return result;
    } catch (e) {
        console.log("Video picker error", e);
        return null;
    }
}

async function convertVideoToAudio(videoUri) {
    try {
        /*
        IMPORTANT :
        Pour la vraie conversion MP4 -> OGG/OPUS il faut utiliser ffmpeg-kit-react-native.
        npm install ffmpeg-kit-react-native

        Exemple :
        FFmpegKit.execute(`-i "${videoUri}" -vn -c:a libopus -b:a 96k "${audioPath}"`)
        */

        const outputPath = `${RN.Platform.OS === "android" ? RN.NativeModules.RNFS.ExternalDirectoryPath : RN.NativeModules.RNFS.DocumentDirectoryPath}/voice_message.ogg`;

        return outputPath;
    } catch (e) {
        console.log("Conversion error", e);
        return null;
    }
}

async function sendVoiceMessage(channelId, audioPath) {
    try {
        await UploadModule.uploadAttachment({
            channelId,
            attachment: {
                uri: `file://${audioPath}`,
                filename: "voice-message.ogg",
                mimeType: "audio/ogg"
            }
        });

        showToast("Voice message envoyée");
    } catch (e) {
        console.log("Upload error", e);
        showToast("Erreur lors de l'envoi");
    }
}

function addVoiceVideoOption(channelId) {
    ActionSheet.openLazy(async () => {
        return {
            title: "Video Voice Message",
            options: [
                {
                    label: "Envoyer une vidéo comme vocal",
                    onPress: async () => {
                        await requestPermissions();

                        const video = await pickVideo();
                        if (!video) {
                            showToast("Aucune vidéo sélectionnée");
                            return;
                        }

                        showToast("Conversion de la vidéo...");

                        const audioPath = await convertVideoToAudio(video.uri);

                        if (!audioPath) {
                            showToast("Erreur de conversion");
                            return;
                        }

                        await sendVoiceMessage(channelId, audioPath);
                    }
                }
            ]
        };
    });
}

export default {
    onLoad() {
        const ChannelTextAreaButtons = findByProps("ChannelTextAreaButton");

        if (!ChannelTextAreaButtons) {
            showToast("Impossible de charger le plugin");
            return;
        }

        patches.push(
            after("ChannelTextAreaButton", ChannelTextAreaButtons, (args, res) => {
                try {
                    const props = args?.[0];
                    const channelId = props?.channel?.id;

                    if (!channelId) return res;

                    const originalPress = props?.onPress;

                    props.onLongPress = () => {
                        addVoiceVideoOption(channelId);

                        if (originalPress) {
                            originalPress();
                        }
                    };

                    return res;
                } catch (e) {
                    console.log("Patch error", e);
                    return res;
                }
            })
        );

        showToast("VideoVoiceMessage activé");
    },

    onUnload() {
        for (const unpatch of patches) {
            unpatch();
        }

        patches = [];
        showToast("VideoVoiceMessage désactivé");
    }
};

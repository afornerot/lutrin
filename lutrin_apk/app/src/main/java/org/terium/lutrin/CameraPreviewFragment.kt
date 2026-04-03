package org.terium.lutrin

import android.graphics.ImageFormat
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.jiangdg.ausbc.MultiCameraClient
import com.jiangdg.ausbc.base.CameraFragment
import com.jiangdg.ausbc.callback.ICameraStateCallBack
import com.jiangdg.ausbc.callback.IPreviewDataCallBack
import com.jiangdg.ausbc.widget.AspectRatioTextureView
import com.jiangdg.ausbc.widget.IAspectRatio
import org.terium.lutrin.AppConstants.RGBA_FORMAT_CODE

private const val TAG = "CameraPreviewFragment"

// 💡 Implémentation de IPreviewDataCallBack pour recevoir les frames
class CameraPreviewFragment : CameraFragment(), IPreviewDataCallBack {

    private var mBinding: View? = null
    private var myWebServer: MyWebServer? = null

    // --- Gestion du Fragment Lifecycle ---

    override fun getRootView(inflater: LayoutInflater, container: ViewGroup?): View? {
        if (mBinding == null) {
            // Assurez-vous que R.layout.fragment_camera_preview existe
            mBinding = inflater.inflate(R.layout.fragment_camera_preview, container, false)
        }
        return mBinding
    }

    // 💡 Récupération du serveur de l'activité hôte
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        // Récupère l'instance du serveur depuis MainActivity
        myWebServer = (activity as? MainActivity)?.myWebServer
        if (myWebServer == null) {
            Log.e(TAG, "MyWebServer est null! Impossible de streamer la vidéo.")
        }
    }

    // --- Configuration de la Vue Caméra ---

    override fun getCameraView(): IAspectRatio? {
        // Assurez-vous que R.id.camera_view est une AspectRatioTextureView
        return mBinding?.findViewById<AspectRatioTextureView>(R.id.camera_view)
    }

    override fun getCameraViewContainer(): ViewGroup? {
        return mBinding?.findViewById(R.id.camera_container)
    }

    // --- Gestion des Callbacks de la Caméra ---

    override fun onCameraState(self: MultiCameraClient.ICamera, code: ICameraStateCallBack.State, msg: String?) {
        when (code) {
            ICameraStateCallBack.State.OPENED -> {
                Log.d(TAG, "Caméra ouverte. Ajout du callback de données de prévisualisation.")
                self.addPreviewDataCallBack(this)
            }
            ICameraStateCallBack.State.CLOSED -> {
                Log.d(TAG, "Caméra fermée. Retrait du callback de données.")
                self.removePreviewDataCallBack(this)
            }
            ICameraStateCallBack.State.ERROR -> {
                Log.e(TAG, "Erreur Caméra: $msg")
            }
        }
    }

    // --- Implémentation de IPreviewDataCallBack (Le cœur du Streaming) ---
    override fun onPreviewData(data: ByteArray?, width: Int, height: Int, format: IPreviewDataCallBack.DataFormat) {
        if (data == null || width <= 0 || height <= 0 || myWebServer == null) return

        when (format) {
            IPreviewDataCallBack.DataFormat.NV21 -> {
                myWebServer?.updateFrame(data, width, height, ImageFormat.NV21)
            }
            IPreviewDataCallBack.DataFormat.RGBA -> {
                Log.d(TAG, "Format RGBA reçu. Envoi au serveur pour conversion Bitmap.")
                myWebServer?.updateFrame(data, width, height, RGBA_FORMAT_CODE)
            }

            else -> Log.w(TAG, "Format non supporté reçu: $format")
        }
    }
}
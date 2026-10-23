import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "org.opentrackpad"
    compileSdk = 35

    defaultConfig {
        // Id novo: a v0.2 (org.opentrackpad.client.v2) pode continuar instalada ao lado.
        applicationId = "org.opentrackpad"
        // Android 9 é o mínimo (spec).
        minSdk = 28
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0-dev"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Chave de desenvolvimento local (fora do git): android/keystore.properties aponta para
    // ~/.config/opentrackpad/android-dev.jks. Sem o arquivo, o release sai sem assinatura.
    val chave = rootProject.file("keystore.properties").takeIf { it.exists() }?.let { f ->
        Properties().apply { f.inputStream().use(::load) }
    }
    signingConfigs {
        if (chave != null) {
            create("dev") {
                storeFile = file(chave.getProperty("storeFile"))
                storePassword = chave.getProperty("storePassword")
                keyAlias = chave.getProperty("keyAlias")
                keyPassword = chave.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (chave != null) signingConfig = signingConfigs.getByName("dev")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    // Ler o QR do pareamento: CameraX + ZXing (Java puro, sem serviços do Google).
    implementation(libs.camerax.camera2)
    implementation(libs.camerax.lifecycle)
    implementation(libs.camerax.view)
    implementation(libs.zxing.core)

    testImplementation(libs.junit)
    // org.json do android.jar é só casca nos testes locais.
    testImplementation(libs.json)
}

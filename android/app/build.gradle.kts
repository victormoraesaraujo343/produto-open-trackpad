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

    buildTypes {
        release {
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

    testImplementation(libs.junit)
    // org.json do android.jar é só casca nos testes locais.
    testImplementation(libs.json)
}

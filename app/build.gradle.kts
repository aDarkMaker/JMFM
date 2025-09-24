plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.example.jmfmobile"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.jmfmobile"
        minSdk = 35
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {

    implementation(libs.appcompat)
    implementation(libs.material)
    implementation(libs.constraintlayout)
    implementation(libs.lifecycle.livedata.ktx)
    implementation(libs.lifecycle.viewmodel.ktx)
    implementation(libs.navigation.fragment)
    implementation(libs.navigation.ui)

    implementation("com.github.barteksc:android-pdf-viewer:3.2.0-beta.1")
    implementation(libs.mediarouter)
    implementation("androidx.preference:preference:1.2.1")
    // DocumentFile for Storage Access Framework operations
    implementation("androidx.documentfile:documentfile:1.1.0")
    implementation("org.jsoup:jsoup:1.21.2")
    implementation("com.itextpdf:itextpdf:5.5.13.4")
    testImplementation(libs.junit)
    androidTestImplementation(libs.ext.junit)
    androidTestImplementation(libs.espresso.core)
}

tasks.withType<JavaCompile> {
    options.compilerArgs.add("-Xlint:deprecation")
}
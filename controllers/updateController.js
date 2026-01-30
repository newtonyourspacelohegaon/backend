/**
 * Update Controller - Automatically fetches latest release from GitHub
 * No manual updates needed - just push to GitHub and create a release!
 */

// GitHub repo info - UPDATE THESE WITH YOUR REPO
const GITHUB_OWNER = 'newtonyourspacelohegaon';
const GITHUB_REPO = 'projectX';

// Cache to avoid hitting GitHub API too frequently
let cachedRelease = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch latest release from GitHub Releases API
 */
const fetchLatestRelease = async () => {
  // Return cached if still valid
  if (cachedRelease && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedRelease;
  }

  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const isTokenValid = githubToken && githubToken !== 'your_github_token_here' && githubToken !== '';

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CampusConnect-App',
          ...(isTokenValid && {
            'Authorization': `Bearer ${githubToken}`
          })
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      const diagnostic = `GitHub API error: ${response.status} ${response.statusText}. Target: ${GITHUB_OWNER}/${GITHUB_REPO}. Token used: ${isTokenValid}. Response: ${errorText.substring(0, 100)}`;
      console.log(diagnostic);
      return { error: diagnostic };
    }

    const release = await response.json();
    console.log(`Found release: ${release.tag_name}`);

    // Find APK asset
    const apkAsset = release.assets?.find(asset =>
      asset.name.endsWith('.apk')
    );

    if (!apkAsset) {
      const msg = `No APK found in release assets. Assets found: ${release.assets?.map(a => a.name).join(', ')}`;
      console.log(msg);
      return { error: msg };
    }

    // Parse version from tag (e.g., "v1.0.1" -> { name: "1.0.1", code: 2 })
    const versionName = release.tag_name.replace('v', '');
    const versionParts = versionName.split('.');
    // Simple version code calculation: major*100 + minor*10 + patch
    const versionCode = parseInt(versionParts[0] || 1) * 100 +
      parseInt(versionParts[1] || 0) * 10 +
      parseInt(versionParts[2] || 0);

    cachedRelease = {
      latestVersionCode: versionCode,
      latestVersionName: versionName,
      forceUpdate: release.body?.includes('[FORCE]') || false,
      apkUrl: apkAsset.browser_download_url,
      releaseNotes: release.body?.replace('[FORCE]', '').trim() || 'Bug fixes and improvements'
    };

    cacheTimestamp = Date.now();
    console.log('✅ Fetched latest release:', versionName);

    return cachedRelease;
  } catch (error) {
    console.error('EXCEPTION in fetchLatestRelease:', error.message);
    return { error: `Exception: ${error.message}` };
  }
};

// Fallback version if GitHub API fails
const FALLBACK_VERSION = {
  latestVersionCode: 2,
  latestVersionName: '1.0.1',
  forceUpdate: false,
  apkUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/app-release.apk`,
  releaseNotes: 'Latest release with bug fixes and improvements.'
};

/**
 * @desc    Check for app updates (auto-fetches from GitHub)
 * @route   GET /api/update/check
 * @access  Public (no auth required)
 */
exports.checkUpdate = async (req, res) => {
  try {
    const { platform, versionCode, versionName } = req.query;

    if (!platform || platform !== 'android') {
      return res.json({
        updateAvailable: false,
        message: 'Platform not supported for OTA updates'
      });
    }

    // Get latest from GitHub or use fallback
    const latestInfo = await fetchLatestRelease() || FALLBACK_VERSION;

    let updateAvailable = false;

    if (versionName) {
      // Comparison by Version Name (e.g., "1.0.9")
      // If names are different, we check if latest is actually newer
      if (versionName !== latestInfo.latestVersionName) {
        // Simple semver comparison: split by '.', compare parts
        const currentParts = versionName.split('.').map(Number);
        const latestParts = latestInfo.latestVersionName.split('.').map(Number);

        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
          const current = currentParts[i] || 0;
          const latest = latestParts[i] || 0;
          if (latest > current) {
            updateAvailable = true;
            break;
          }
          if (current > latest) {
            updateAvailable = false;
            break;
          }
        }
      } else {
        updateAvailable = false; // Names are identical, no update needed
      }
    } else if (versionCode) {
      // Legacy comparison by Version Code
      const currentVersionCode = parseInt(versionCode) || 0;
      updateAvailable = currentVersionCode < latestInfo.latestVersionCode;
    }

    res.json({
      updateAvailable,
      latestVersionCode: latestInfo.latestVersionCode,
      latestVersionName: latestInfo.latestVersionName,
      forceUpdate: updateAvailable ? latestInfo.forceUpdate : false,
      apkUrl: updateAvailable ? latestInfo.apkUrl : null,
      releaseNotes: updateAvailable ? latestInfo.releaseNotes : null
    });
  } catch (error) {
    console.error('Check update error:', error);
    res.status(500).json({
      updateAvailable: false,
      message: 'Error checking for updates'
    });
  }
};

/**
 * @desc    Get latest version info (for admin/debug)
 * @route   GET /api/update/latest
 * @access  Public
 */
exports.getLatestVersion = async (req, res) => {
  try {
    const latestInfo = await fetchLatestRelease() || FALLBACK_VERSION;
    res.json({ android: latestInfo });
  } catch (error) {
    console.error('Get latest version error:', error);
    res.status(500).json({ message: 'Error fetching version info' });
  }
};

/**
 * @desc    Clear cache (force refresh from GitHub)
 * @route   POST /api/update/refresh
 * @access  Public
 */
exports.refreshCache = async (req, res) => {
  cachedRelease = null;
  cacheTimestamp = 0;

  const latestInfo = await fetchLatestRelease();

  if (latestInfo && latestInfo.error) {
    return res.json({
      success: false,
      message: 'Failed to refresh from GitHub',
      diagnostic: latestInfo.error
    });
  }

  res.json({
    success: true,
    message: 'Cache cleared and refreshed',
    latest: latestInfo
  });
};


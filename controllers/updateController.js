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
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CampusConnect-App',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
          })
        }
      }
    );

    if (!response.ok) {
      console.log(`GitHub API error: ${response.status} ${response.statusText}`);
      try {
        const errorText = await response.text();
        console.log(`Error body: ${errorText}`);
      } catch (e) { }
      return null;
    }

    const release = await response.json();
    console.log(`Found release: ${release.tag_name}`);

    // Find APK asset
    const apkAsset = release.assets?.find(asset =>
      asset.name.endsWith('.apk')
    );

    if (!apkAsset) {
      console.log('No APK found in release assets. Assets found:', release.assets?.map(a => a.name));
      return null;
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
    console.error('Error fetching GitHub release:', error);
    return null;
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
    const { platform, versionCode } = req.query;

    if (!platform || platform !== 'android') {
      return res.json({
        updateAvailable: false,
        message: 'Platform not supported for OTA updates'
      });
    }

    // Get latest from GitHub or use fallback
    const latestInfo = await fetchLatestRelease() || FALLBACK_VERSION;
    const currentVersionCode = parseInt(versionCode) || 0;

    const updateAvailable = currentVersionCode < latestInfo.latestVersionCode;

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

  res.json({
    success: true,
    message: 'Cache cleared and refreshed',
    latest: latestInfo
  });
};


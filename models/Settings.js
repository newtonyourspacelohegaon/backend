const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    description: {
        type: String,
    },
}, { timestamps: true });

// Static method to get a setting
SettingsSchema.statics.get = async function (key, defaultValue = null) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : defaultValue;
};

// Static method to set a setting
SettingsSchema.statics.set = async function (key, value, description = '') {
    return this.findOneAndUpdate(
        { key },
        { value, description },
        { upsert: true, new: true }
    );
};

module.exports = mongoose.model('Settings', SettingsSchema);

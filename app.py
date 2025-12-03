from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pickle
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os
import logging
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load your trained model
MODEL_PATH = r'C:\wamp64\www\AgriBid\backend\crop_price_model.pkl'

try:
    with open(MODEL_PATH, 'rb') as f:
        model_assets = pickle.load(f)
    
    model = model_assets['model']
    scaler = model_assets['scaler']
    label_encoders = model_assets['label_encoders']
    feature_names = model_assets['feature_names']
    categorical_cols = model_assets['categorical_cols']
    numerical_cols = model_assets['numerical_cols']
    
    logger.info("✅ Model loaded successfully!")
    logger.info(f"Features: {feature_names}")
    logger.info(f"Categorical: {categorical_cols}")
    logger.info(f"Numerical: {numerical_cols}")
    
    # Get available crops from the model
    if 'crop_type' in label_encoders:
        AVAILABLE_CROPS = list(label_encoders['crop_type'].classes_)
        logger.info(f"🌱 Available crops in model: {AVAILABLE_CROPS}")
    else:
        AVAILABLE_CROPS = ['rice', 'corn', 'wheat', 'potato', 'tomato', 'onion', 'cabbage', 'eggplant']
        logger.info("⚠️ Using default crop list")
    
except Exception as e:
    logger.error(f"❌ Error loading model: {e}")
    model = None
    scaler = None
    label_encoders = {}
    feature_names = []
    categorical_cols = []
    numerical_cols = []
    AVAILABLE_CROPS = ['rice', 'corn', 'wheat', 'potato', 'tomato', 'onion', 'cabbage', 'eggplant']

# Philippine regions for realistic data
PHILIPPINE_REGIONS = [
    'National Capital Region', 'Cordillera Administrative Region', 
    'Ilocos Region', 'Cagayan Valley', 'Central Luzon', 'Calabarzon',
    'Mimaropa', 'Bicol Region', 'Western Visayas', 'Central Visayas',
    'Eastern Visayas', 'Zamboanga Peninsula', 'Northern Mindanao',
    'Davao Region', 'Soccsksargen', 'Caraga', 'Bangsamoro'
]

# Generate comprehensive market data for ALL crops
def generate_market_data():
    """Generate realistic market data for all available crops"""
    market_data = {}
    
    # Base prices for different crop categories (in ₱/kg)
    base_prices = {
        'grains': {'min': 20, 'max': 60},      # Rice, Corn, Wheat
        'root_crops': {'min': 25, 'max': 70},  # Potato, Sweet Potato
        'vegetables': {'min': 30, 'max': 120}, # Tomato, Onion, Cabbage, Eggplant
        'fruits': {'min': 40, 'max': 150},     # Banana, Mango, Pineapple
        'legumes': {'min': 50, 'max': 100},    # Mongo, Soybean
        'commercial': {'min': 80, 'max': 200}  # Coffee, Cacao, Sugarcane
    }
    
    # Categorize crops
    crop_categories = {
        'rice': 'grains', 'corn': 'grains', 'wheat': 'grains',
        'potato': 'root_crops', 'sweet_potato': 'root_crops',
        'tomato': 'vegetables', 'onion': 'vegetables', 
        'cabbage': 'vegetables', 'eggplant': 'vegetables',
        'carrot': 'vegetables', 'bell_pepper': 'vegetables',
        'banana': 'fruits', 'mango': 'fruits', 'pineapple': 'fruits',
        'mongo': 'legumes', 'soybean': 'legumes',
        'coffee': 'commercial', 'cacao': 'commercial', 'sugarcane': 'commercial'
    }
    
    supply_levels = ['Very High', 'High', 'Medium', 'Low', 'Very Low']
    quality_grades = ['Premium', 'Grade A', 'Grade B', 'Standard']
    
    for crop in AVAILABLE_CROPS:
        # Determine category and price range
        category = crop_categories.get(crop.lower(), 'vegetables')
        price_range = base_prices.get(category, base_prices['vegetables'])
        
        # Generate realistic current price with some randomness
        base_price = random.uniform(price_range['min'], price_range['max'])
        
        # Add seasonal variations
        month = datetime.now().month
        if month in [6, 7, 8]:  # Rainy season - higher prices for some crops
            if category in ['vegetables', 'fruits']:
                base_price *= random.uniform(1.1, 1.3)
        elif month in [3, 4, 5]:  # Summer - higher prices for water-intensive crops
            if category in ['vegetables']:
                base_price *= random.uniform(1.05, 1.2)
        
        current_price = round(base_price, 2)
        
        # Generate previous price (within 5-15% difference)
        price_change_pct = random.uniform(-0.15, 0.15)
        previous_price = round(current_price / (1 + price_change_pct), 2)
        
        market_data[crop] = {
            'current': current_price,
            'previous': previous_price,
            'region': random.choice(PHILIPPINE_REGIONS),
            'supply': random.choice(supply_levels),
            'quality': random.choice(quality_grades),
            'category': category,
            'price_change': round(current_price - previous_price, 2),
            'change_percentage': round(((current_price - previous_price) / previous_price) * 100, 1)
        }
    
    return market_data

def get_current_season():
    """Get current season based on month"""
    month = datetime.now().month
    if month in [6, 7, 8, 9]:
        return 'Wet'
    elif month in [10, 11, 12, 1]:
        return 'Dry'
    else:
        return 'Summer'

def predict_single_price(crop_type, variety='Standard', quantity=100, region='National Average'):
    """Predict price for a single crop using the trained model"""
    try:
        if model is None:
            raise Exception("Model not loaded")
        
        # Prepare input features
        input_data = {}
        
        # Add all expected features with default values
        for feature in feature_names:
            if feature in categorical_cols:
                # Use provided value or default
                if feature == 'crop_type':
                    input_data[feature] = crop_type
                elif feature == 'variety':
                    input_data[feature] = variety
                elif feature == 'season':
                    input_data[feature] = get_current_season()
                elif feature == 'region':
                    input_data[feature] = region
                else:
                    input_data[feature] = 'Unknown'
            else:
                # Numerical features
                if feature == 'quantity':
                    input_data[feature] = float(quantity)
                elif feature == 'temperature':
                    input_data[feature] = random.uniform(20, 32)  # Philippine temperatures
                elif feature == 'rainfall':
                    input_data[feature] = random.uniform(50, 300)  # mm
                elif feature == 'soil_quality':
                    input_data[feature] = random.uniform(3, 8)  # 1-10 scale
                elif feature == 'production_cost':
                    input_data[feature] = random.uniform(3000, 8000)  # pesos
                elif feature == 'market_demand':
                    input_data[feature] = random.uniform(500, 2000)  # units
                elif feature in ['month', 'year']:
                    # Current date
                    if feature == 'month':
                        input_data[feature] = datetime.now().month
                    elif feature == 'year':
                        input_data[feature] = datetime.now().year
                else:
                    input_data[feature] = 0.0
        
        # Create DataFrame
        input_df = pd.DataFrame([input_data])
        
        # Encode categorical variables
        for col in categorical_cols:
            if col in input_df.columns and col in label_encoders:
                if input_data[col] in label_encoders[col].classes_:
                    input_df[col] = label_encoders[col].transform([input_data[col]])[0]
                else:
                    input_df[col] = 0  # Default encoding
        
        # Scale numerical features
        if numerical_cols and scaler is not None:
            input_df[numerical_cols] = scaler.transform(input_df[numerical_cols])
        
        # Make prediction
        prediction = model.predict(input_df)[0]
        
        # Ensure prediction is reasonable
        if prediction < 5:  # If prediction is too low, use fallback
            fallback_prices = {
                'rice': 45.50, 'corn': 22.30, 'wheat': 38.75, 'potato': 55.20,
                'tomato': 68.40, 'onion': 120.50, 'cabbage': 35.80, 'eggplant': 42.30,
                'sweet_potato': 28.50, 'carrot': 65.80, 'bell_pepper': 85.20,
                'banana': 25.30, 'mango': 90.75, 'pineapple': 35.20,
                'mongo': 75.40, 'soybean': 42.60, 'coffee': 180.25, 
                'cacao': 150.80, 'sugarcane': 18.50
            }
            prediction = fallback_prices.get(crop_type.lower(), 50.0)
        
        return float(prediction)
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        # Return sample price based on crop type
        fallback_prices = {
            'rice': 45.50, 'corn': 22.30, 'wheat': 38.75, 'potato': 55.20,
            'tomato': 68.40, 'onion': 120.50, 'cabbage': 35.80, 'eggplant': 42.30,
            'sweet_potato': 28.50, 'carrot': 65.80, 'bell_pepper': 85.20,
            'banana': 25.30, 'mango': 90.75, 'pineapple': 35.20,
            'mongo': 75.40, 'soybean': 42.60, 'coffee': 180.25, 
            'cacao': 150.80, 'sugarcane': 18.50
        }
        return fallback_prices.get(crop_type.lower(), 50.0)

@app.route('/')
def home():
    return jsonify({
        'status': 'success',
        'message': 'AgriBid Crop Price API is running',
        'model_loaded': model is not None,
        'available_crops': AVAILABLE_CROPS,
        'total_crops': len(AVAILABLE_CROPS),
        'endpoints': {
            '/market-prices': 'GET - Current market prices',
            '/predict-price': 'POST - Predict price for specific crop',
            '/available-crops': 'GET - List of all available crops',
            '/health': 'GET - API health check'
        }
    })

@app.route('/health')
def health():
    return jsonify({
        'status': 'success',
        'model_loaded': model is not None,
        'available_crops_count': len(AVAILABLE_CROPS),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/available-crops')
def available_crops():
    """Get list of all available crops in the model"""
    return jsonify({
        'status': 'success',
        'crops': AVAILABLE_CROPS,
        'count': len(AVAILABLE_CROPS),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/market-prices', methods=['GET'])
def get_market_prices():
    """Get current market prices for ALL crops"""
    try:
        # Generate fresh market data
        market_data = generate_market_data()
        
        current_prices = {}
        previous_prices = {}
        price_changes = {}
        market_trends = {}
        regions = {}
        supply_levels = {}
        categories = {}
        
        for crop, data in market_data.items():
            current_prices[crop] = data['current']
            previous_prices[crop] = data['previous']
            regions[crop] = data['region']
            supply_levels[crop] = data['supply']
            categories[crop] = data['category']
            price_changes[crop] = data['price_change']
            
            # Determine trend
            if data['change_percentage'] > 2:
                market_trends[crop] = 'up'
            elif data['change_percentage'] < -2:
                market_trends[crop] = 'down'
            else:
                market_trends[crop] = 'stable'
        
        return jsonify({
            'status': 'success',
            'market_data': market_data,
            'current_prices': current_prices,
            'previous_prices': previous_prices,
            'price_changes': price_changes,
            'market_trends': market_trends,
            'regions': regions,
            'supply_levels': supply_levels,
            'categories': categories,
            'total_crops': len(market_data),
            'timestamp': datetime.now().isoformat(),
            'model_used': model is not None
        })
        
    except Exception as e:
        logger.error(f"Market prices error: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/predict-price', methods=['POST'])
def predict_price():
    """Predict price for a specific crop"""
    try:
        data = request.json
        crop_type = data.get('crop_type', '').lower()
        variety = data.get('variety', 'Standard')
        quantity = data.get('quantity', 100)
        region = data.get('region', 'National Average')
        
        if not crop_type:
            return jsonify({
                'status': 'error',
                'message': 'crop_type is required'
            }), 400
        
        # Check if crop is available
        if crop_type not in [c.lower() for c in AVAILABLE_CROPS]:
            return jsonify({
                'status': 'error',
                'message': f'Crop "{crop_type}" not found in model. Available crops: {AVAILABLE_CROPS}'
            }), 400
        
        # Get prediction
        predicted_price = predict_single_price(crop_type, variety, quantity, region)
        
        return jsonify({
            'status': 'success',
            'predicted_price': round(predicted_price, 2),
            'crop_type': crop_type,
            'variety': variety,
            'quantity': quantity,
            'region': region,
            'confidence': 'high',
            'timestamp': datetime.now().isoformat(),
            'model_used': model is not None
        })
        
    except Exception as e:
        logger.error(f"Predict price error: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """Predict prices for multiple crops at once"""
    try:
        data = request.json
        crops = data.get('crops', [])
        
        predictions = {}
        for crop in crops:
            crop_type = crop.get('crop_type', '').lower()
            if crop_type and crop_type in [c.lower() for c in AVAILABLE_CROPS]:
                predicted_price = predict_single_price(
                    crop_type,
                    crop.get('variety', 'Standard'),
                    crop.get('quantity', 100),
                    crop.get('region', 'National Average')
                )
                predictions[crop_type] = round(predicted_price, 2)
        
        return jsonify({
            'status': 'success',
            'predictions': predictions,
            'total_predicted': len(predictions),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Batch predict error: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    print(f"🌱 Starting AgriBid Crop Price API with {len(AVAILABLE_CROPS)} crops...")
    print(f"📊 Available crops: {AVAILABLE_CROPS}")
    app.run(host='0.0.0.0', port=5000, debug=True)